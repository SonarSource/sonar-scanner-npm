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
import { SCANNER_CLI_DEFAULT_BIN_NAME } from './constants';
import {
  fetchJRE as defaultFetchJRE,
  serverSupportsJREProvisioning as defaultServerSupportsJREProvisioning,
} from './java';
import { LogLevel, log, setLogLevel } from './logging';
import { locateExecutableFromPath as defaultLocateExecutableFromPath } from './process';
import { getProperties } from './properties';
import { initializeAxios } from './request';
import {
  downloadScannerCli as defaultDownloadScannerCli,
  runScannerCli as defaultRunScannerCli,
} from './scanner-cli';
import {
  fetchScannerEngine as defaultFetchScannerEngine,
  runScannerEngine as defaultRunScannerEngine,
} from './scanner-engine';
import { type CliArgs, type ScanOptions, ScannerProperty } from './types';
import { version } from './version';

export interface ScanDeps {
  serverSupportsJREProvisioningFn?: typeof defaultServerSupportsJREProvisioning;
  fetchJREFn?: typeof defaultFetchJRE;
  downloadScannerCliFn?: typeof defaultDownloadScannerCli;
  runScannerCliFn?: typeof defaultRunScannerCli;
  fetchScannerEngineFn?: typeof defaultFetchScannerEngine;
  runScannerEngineFn?: typeof defaultRunScannerEngine;
  locateExecutableFromPathFn?: typeof defaultLocateExecutableFromPath;
}

export async function scan(scanOptions: ScanOptions, cliArgs?: CliArgs, deps: ScanDeps = {}) {
  try {
    await runScan(scanOptions, cliArgs, deps);
  } catch (error) {
    log(LogLevel.ERROR, `An error occurred: ${error}`);
    throw error;
  }
}

async function runScan(
  scanOptions: ScanOptions,
  cliArgs?: CliArgs,
  {
    serverSupportsJREProvisioningFn = defaultServerSupportsJREProvisioning,
    fetchJREFn = defaultFetchJRE,
    downloadScannerCliFn = defaultDownloadScannerCli,
    runScannerCliFn = defaultRunScannerCli,
    fetchScannerEngineFn = defaultFetchScannerEngine,
    runScannerEngineFn = defaultRunScannerEngine,
    locateExecutableFromPathFn = defaultLocateExecutableFromPath,
  }: ScanDeps = {},
) {
  const startTimestampMs = Date.now();
  const properties = getProperties(scanOptions, startTimestampMs, cliArgs);

  if (properties[ScannerProperty.SonarVerbose] === 'true') {
    setLogLevel(LogLevel.DEBUG);
    log(LogLevel.DEBUG, 'Setting the log level to DEBUG due to verbose mode');
  }

  if (properties[ScannerProperty.SonarLogLevel]) {
    setLogLevel(properties[ScannerProperty.SonarLogLevel]);
    log(LogLevel.DEBUG, `Overriding the log level to ${properties[ScannerProperty.SonarLogLevel]}`);
  }

  log(LogLevel.DEBUG, 'Properties:', properties);
  log(
    LogLevel.INFO,
    'Platform:',
    properties[ScannerProperty.SonarScannerOs],
    properties[ScannerProperty.SonarScannerArch],
  );

  await initializeAxios(properties);

  log(LogLevel.INFO, `Server URL: ${properties[ScannerProperty.SonarHostUrl]}`);
  log(LogLevel.INFO, `Version: ${version}`);

  log(LogLevel.DEBUG, 'Check if Server supports JRE provisioning');
  const supportsJREProvisioning = await serverSupportsJREProvisioningFn(properties);
  log(LogLevel.INFO, `JRE provisioning ${supportsJREProvisioning ? 'is' : 'is NOT'} supported`);

  if (!supportsJREProvisioning) {
    log(LogLevel.INFO, 'Falling back on using sonar-scanner-cli');
    if (scanOptions.localScannerCli) {
      log(LogLevel.INFO, 'Local scanner is requested, will not download sonar-scanner-cli');
      const scannerPath = await locateExecutableFromPathFn(SCANNER_CLI_DEFAULT_BIN_NAME);
      if (!scannerPath) {
        throw new Error('SonarScanner CLI not found in PATH');
      }
      await runScannerCliFn(scanOptions, properties, scannerPath);
    } else {
      const binPath = await downloadScannerCliFn(properties);
      await runScannerCliFn(scanOptions, properties, binPath);
    }
    return;
  }

  // Detect what Java to use (in path, specified from properties or provisioned)
  let javaPath: string;
  if (properties[ScannerProperty.SonarScannerJavaExePath]) {
    javaPath = properties[ScannerProperty.SonarScannerJavaExePath];
  } else if (properties[ScannerProperty.SonarScannerSkipJreProvisioning] === 'true') {
    const absoluteJavaPath = await locateExecutableFromPathFn('java');
    if (!absoluteJavaPath) {
      throw new Error('Java not found in PATH');
    }
    javaPath = absoluteJavaPath;
  } else {
    javaPath = await fetchJREFn(properties);
  }

  // Fetch the Scanner Engine
  const latestScannerEngine = await fetchScannerEngineFn(properties);

  // Run the Scanner Engine
  await runScannerEngineFn(javaPath, latestScannerEngine, scanOptions, properties);
}
