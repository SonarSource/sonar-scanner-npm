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
import * as fsExtra from 'fs-extra';
import path from 'path';
import {
  SCANNER_CLI_INSTALL_PATH,
  SCANNER_CLI_MIRROR,
  SCANNER_CLI_VERSION,
  SONAR_DIR,
} from './constants';
import { extractArchive } from './file';
import { LogLevel, log } from './logging';
import { getProxyUrl, proxyUrlToJavaOptions } from './proxy';
import { download } from './request';
import { ScanOptions, ScannerProperties, ScannerProperty } from './types';

export function normalizePlatformName(): 'windows' | 'linux' | 'macosx' {
  if (process.platform.startsWith('win')) {
    return 'windows';
  }
  if (process.platform.startsWith('linux')) {
    return 'linux';
  }
  if (process.platform.startsWith('darwin')) {
    return 'macosx';
  }
  throw Error(`Your platform '${process.platform}' is currently not supported.`);
}

/**
 * Verifies if the provided (or default) command is executable
 */
export async function tryLocalSonarScannerExecutable(command: string): Promise<boolean> {
  return new Promise<boolean>(resolve => {
    log(LogLevel.INFO, `Trying to find a local install of the SonarScanner: ${command}`);
    const scannerProcess = spawn(command, ['-v']);

    scannerProcess.on('exit', code => {
      if (code === 0) {
        log(LogLevel.INFO, 'Local install of SonarScanner CLI found.');
        resolve(true);
      } else {
        log(LogLevel.INFO, `Local install of SonarScanner CLI (${command}) not found`);
        resolve(false);
      }
    });
  });
}

/**
 * Where to download the SonarScanner CLI
 */
function getScannerCliUrl(properties: ScannerProperties, version: string): URL {
  // Get location to download scanner-cli from
  const scannerCliMirror = properties[ScannerProperty.SonarScannerCliMirror] ?? SCANNER_CLI_MIRROR;
  const scannerCliFileName =
    'sonar-scanner-cli-' + version + '-' + normalizePlatformName() + '.zip';
  return new URL(scannerCliFileName, scannerCliMirror);
}

export async function downloadScannerCli(properties: ScannerProperties): Promise<string> {
  const token = properties[ScannerProperty.SonarToken];
  const version = properties[ScannerProperty.SonarScannerCliVersion] ?? SCANNER_CLI_VERSION;
  if (!/^[\d.]+$/.test(version)) {
    throw new Error(`Version "${version}" does not have a correct format."`);
  }

  const proxyUrl = getProxyUrl(properties);
  const scannerCliUrl = getScannerCliUrl(properties, version);

  // Build paths
  const binExt = normalizePlatformName() === 'windows' ? '.bat' : '';
  const dirName = `sonar-scanner-${version}-${normalizePlatformName()}`;
  const installDir = path.join(SONAR_DIR, SCANNER_CLI_INSTALL_PATH);
  const archivePath = path.join(installDir, `${dirName}.zip`);
  const binPath = path.join(installDir, dirName, 'bin', `sonar-scanner${binExt}`);

  // Try and execute an already downloaded scanner, which should be at the same location
  if (await tryLocalSonarScannerExecutable(binPath)) {
    return binPath;
  }

  // Create parent directory if needed
  await fsExtra.ensureDir(installDir);

  // Download SonarScanner CLI
  log(LogLevel.INFO, 'Downloading SonarScanner CLI');
  await download(scannerCliUrl.href, archivePath);

  log(LogLevel.INFO, `Extracting SonarScanner CLI archive`);
  extractArchive(archivePath, installDir);

  return binPath;
}

export async function runScannerCli(
  scanOptions: ScanOptions,
  properties: ScannerProperties,
  binPath: string,
) {
  log(LogLevel.INFO, 'Starting analysis');

  const options = [...(scanOptions.jvmOptions ?? []), ...proxyUrlToJavaOptions(properties)];
  const scannerProcess = spawn(binPath, options, {
    env: {
      ...process.env,
      SONARQUBE_SCANNER_PARAMS: JSON.stringify(properties),
    },
  });

  return new Promise<void>((resolve, reject) => {
    scannerProcess.stdout.on('data', data => {
      for (const line of data.toString().trim().split('\n')) {
        log(LogLevel.INFO, line);
      }
    });
    scannerProcess.stderr.on('data', data => {
      log(LogLevel.ERROR, data.toString().trim());
    });
    scannerProcess.on('exit', code => {
      if (code === 0) {
        log(LogLevel.INFO, 'SonarScanner CLI finished successfully');
        resolve();
      } else {
        log(LogLevel.ERROR, `SonarScanner CLI failed with code ${code}`);
        reject(new Error(`SonarScanner CLI failed with code ${code}`));
      }
    });
  });
}
