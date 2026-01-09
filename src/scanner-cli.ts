/*
 * sonar-scanner-npm
 * Copyright (C) 2022-2025 SonarSource Sàrl
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
import type { AxiosRequestConfig } from 'axios';
import { spawn as nodeSpawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import semver from 'semver';
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
import { type ScanOptions, type ScannerProperties, ScannerProperty } from './types';

export interface ScannerCliFsDeps {
  exists: (path: string) => Promise<boolean>;
  ensureDir: (path: string) => Promise<void>;
}

export interface ScannerCliProcessDeps {
  platform: NodeJS.Platform;
  arch: NodeJS.Architecture;
  env: NodeJS.ProcessEnv;
}

type SpawnFn = typeof nodeSpawn;

const defaultFsDeps: ScannerCliFsDeps = {
  exists: async (filePath: string) => {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  },
  ensureDir: (dirPath: string) => fs.promises.mkdir(dirPath, { recursive: true }).then(() => {}),
};

const defaultProcessDeps: ScannerCliProcessDeps = {
  get platform() {
    return process.platform;
  },
  get arch() {
    return process.arch;
  },
  get env() {
    return process.env;
  },
};

const defaultSpawn: SpawnFn = nodeSpawn;

export interface ScannerCliDeps {
  fsDeps?: ScannerCliFsDeps;
  processDeps?: ScannerCliProcessDeps;
  spawnFn?: SpawnFn;
  downloadFn?: typeof download;
  extractArchiveFn?: typeof extractArchive;
}

export function normalizePlatformName(
  processDeps: ScannerCliProcessDeps = defaultProcessDeps,
): 'windows' | 'linux' | 'macosx' {
  if (isWindows(processDeps)) {
    return 'windows';
  }
  if (isLinux(processDeps)) {
    return 'linux';
  }
  if (isMac(processDeps)) {
    return 'macosx';
  }
  throw new Error(`Your platform '${processDeps.platform}' is currently not supported.`);
}

/**
 * Where to download the SonarScanner CLI
 */
function getScannerCliUrl(
  properties: ScannerProperties,
  versionStr: string,
  archStr?: string,
  processDeps: ScannerCliProcessDeps = defaultProcessDeps,
): URL {
  // Get location to download scanner-cli from

  // Not in default to avoid populating it for non scanner-cli users
  const scannerCliMirror = properties[ScannerProperty.SonarScannerCliMirror] ?? SCANNER_CLI_MIRROR;

  const archSuffix = archStr ? `-${archStr}` : '';
  const scannerCliFileName = `sonar-scanner-cli-${versionStr}-${normalizePlatformName(processDeps)}${archSuffix}.zip`;
  return new URL(scannerCliFileName, scannerCliMirror);
}

export async function downloadScannerCli(
  properties: ScannerProperties,
  deps: ScannerCliDeps = {},
): Promise<string> {
  const {
    fsDeps = defaultFsDeps,
    processDeps = defaultProcessDeps,
    downloadFn = download,
    extractArchiveFn = extractArchive,
  } = deps;

  const versionStr = properties[ScannerProperty.SonarScannerCliVersion] ?? SCANNER_CLI_VERSION;
  const version = semver.coerce(versionStr);
  if (!version) {
    throw new Error(`Version "${versionStr}" does not have a correct format."`);
  }
  const archStr = version.compare('6.1.0') >= 0 ? 'x64' : undefined;
  const archSuffix = archStr ? `-${archStr}` : '';

  // Build paths
  const binExt = normalizePlatformName(processDeps) === 'windows' ? '.bat' : '';
  const dirName = `sonar-scanner-${versionStr}-${normalizePlatformName(processDeps)}${archSuffix}`;
  const installDir = path.join(properties[ScannerProperty.SonarUserHome], SCANNER_CLI_INSTALL_PATH);
  const archivePath = path.join(installDir, `${dirName}.zip`);
  const binPath = path.join(installDir, dirName, 'bin', `sonar-scanner${binExt}`);

  if (await fsDeps.exists(binPath)) {
    return binPath;
  }

  // Create parent directory if needed
  await fsDeps.ensureDir(installDir);

  // Add basic auth credentials when used in the UR
  const scannerCliUrl = getScannerCliUrl(properties, versionStr, archStr, processDeps);
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
  await downloadFn(scannerCliUrl.href, archivePath, overrides);

  log(LogLevel.INFO, `Extracting SonarScanner CLI archive`);
  await extractArchiveFn(archivePath, installDir);

  return binPath;
}

/**
 * @param binPath Absolute path to the scanner CLI executable
 */
export async function runScannerCli(
  scanOptions: ScanOptions,
  properties: ScannerProperties,
  binPath: string,
  deps: ScannerCliDeps = {},
) {
  const { processDeps = defaultProcessDeps, spawnFn = defaultSpawn } = deps;

  log(LogLevel.INFO, 'Starting analysis');
  // We filter out env properties that are passed to the scanner
  // otherwise, they would supersede the properties passed to the scanner through SONARQUBE_SCANNER_PARAMS
  const filteredEnvKeys = ENV_TO_PROPERTY_NAME.map(env => env[0]);
  const filteredEnv = Object.entries(processDeps.env)
    .filter(([key]) => !filteredEnvKeys.includes(key))
    .filter(([key]) => !key.startsWith(ENV_VAR_PREFIX));

  const child = spawnFn(
    binPath,
    [...(scanOptions.jvmOptions ?? []), ...proxyUrlToJavaOptions(properties)],
    {
      env: {
        ...Object.fromEntries(filteredEnv),
        SONARQUBE_SCANNER_PARAMS: JSON.stringify(properties),
      },
      shell: isWindows(processDeps),
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
