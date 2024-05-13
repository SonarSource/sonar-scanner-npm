/*
 * sonar-scanner-npm
 * Copyright (C) 2022-2024 SonarSource SA
 * mailto:info AT sonarsource DOT com
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */
import { spawn } from 'child_process';
import fsExtra from 'fs-extra';
import path from 'path';
import {
  ENV_TO_PROPERTY_NAME,
  ENV_VAR_PREFIX,
  SCANNER_CLI_INSTALL_PATH,
  SCANNER_CLI_MIRROR,
  SCANNER_CLI_VERSION,
} from './constants';
import { extractArchive } from './file';
import { LogLevel, log } from './logging';
import { isLinux, isMac, isWindows } from './platform';
import { proxyUrlToJavaOptions } from './proxy';
import { download } from './request';
import { ScanOptions, ScannerProperties, ScannerProperty } from './types';
import { AxiosRequestConfig } from 'axios';

export function normalizePlatformName(): 'windows' | 'linux' | 'macosx' {
  if (isWindows()) {
    return 'windows';
  }
  if (isLinux()) {
    return 'linux';
  }
  if (isMac()) {
    return 'macosx';
  }
  throw Error(`Your platform '${process.platform}' is currently not supported.`);
}

/**
 * Where to download the SonarScanner CLI
 */
function getScannerCliUrl(properties: ScannerProperties, version: string): URL {
  // Get location to download scanner-cli from

  // Not in default to avoid populating it for non scanner-cli users
  const scannerCliMirror = properties[ScannerProperty.SonarScannerCliMirror] ?? SCANNER_CLI_MIRROR;
  const scannerCliFileName =
    'sonar-scanner-cli-' + version + '-' + normalizePlatformName() + '.zip';
  return new URL(scannerCliFileName, scannerCliMirror);
}

export async function downloadScannerCli(properties: ScannerProperties): Promise<string> {
  const version = properties[ScannerProperty.SonarScannerCliVersion] ?? SCANNER_CLI_VERSION;
  if (!/^[\d.]+$/.test(version)) {
    throw new Error(`Version "${version}" does not have a correct format."`);
  }

  // Build paths
  const binExt = normalizePlatformName() === 'windows' ? '.bat' : '';
  const dirName = `sonar-scanner-${version}-${normalizePlatformName()}`;
  const installDir = path.join(properties[ScannerProperty.SonarUserHome], SCANNER_CLI_INSTALL_PATH);
  const archivePath = path.join(installDir, `${dirName}.zip`);
  const binPath = path.join(installDir, dirName, 'bin', `sonar-scanner${binExt}`);

  if (await fsExtra.exists(binPath)) {
    return binPath;
  }

  // Create parent directory if needed
  await fsExtra.ensureDir(installDir);

  // Add basic auth credentials when used in the UR
  const scannerCliUrl = getScannerCliUrl(properties, version);
  let overrides: AxiosRequestConfig | undefined;
  if (scannerCliUrl.username && scannerCliUrl.password) {
    overrides = {
      headers: {
        Authorization:
          'Basic ' +
          Buffer.from(`${scannerCliUrl.username}:${scannerCliUrl.password}`).toString('base64'),
      },
    };
  }

  // Download SonarScanner CLI
  log(LogLevel.INFO, 'Downloading SonarScanner CLI');
  log(LogLevel.DEBUG, `Downloading from ${scannerCliUrl.href}`);
  await download(scannerCliUrl.href, archivePath, overrides);

  log(LogLevel.INFO, `Extracting SonarScanner CLI archive`);
  await extractArchive(archivePath, installDir);

  return binPath;
}

/**
 * @param binPath Absolute path to the scanner CLI executable
 */
export async function runScannerCli(
  scanOptions: ScanOptions,
  properties: ScannerProperties,
  binPath: string,
) {
  log(LogLevel.INFO, 'Starting analysis');
  // We filter out env properties that are passed to the scanner
  // otherwise, they would supersede the properties passed to the scanner through SONARQUBE_SCANNER_PARAMS
  const filteredEnvKeys = ENV_TO_PROPERTY_NAME.map(env => env[0]);
  const filteredEnv = Object.entries(process.env)
    .filter(([key]) => !filteredEnvKeys.includes(key))
    .filter(([key]) => !key.startsWith(ENV_VAR_PREFIX));

  const child = spawn(
    binPath,
    [...(scanOptions.jvmOptions ?? []), ...proxyUrlToJavaOptions(properties)],
    {
      env: {
        ...Object.fromEntries(filteredEnv),
        SONARQUBE_SCANNER_PARAMS: JSON.stringify(properties),
      },
      shell: isWindows(),
    },
  );

  child.stdout.on('data', buffer => process.stdout.write(buffer));
  child.stderr.on('data', buffer => log(LogLevel.ERROR, buffer.toString()));

  return new Promise<void>((resolve, reject) => {
    child.on('exit', code => {
      if (code === 0) {
        log(LogLevel.INFO, 'SonarScanner CLI finished successfully');
        resolve();
      } else {
        reject(new Error(`SonarScanner CLI failed with code ${code}`));
      }
    });
  });
}
