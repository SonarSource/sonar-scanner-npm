/*
 * sonar-scanner-npm
 * Copyright (C) SonarSource Sàrl
 * mailto:info AT sonarsource DOT com
 *
 * You can redistribute and/or modify this program under the terms of
 * the Sonar Source-Available License Version 1, as published by SonarSource Sàrl.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the Sonar Source-Available License for more details.
 *
 * You should have received a copy of the Sonar Source-Available License
 * along with this program; if not, see https://sonarsource.com/license/ssal/
 */
import { SCANNER_CLI_DEFAULT_BIN_NAME } from './constants';
import { getDeps } from './deps';
import { LogLevel, log, setLogLevel } from './logging';
import { getProperties } from './properties';
import { initializeAxios } from './request';
import type { CliArgs, ScanOptions } from './types';
import { ScannerProperty } from './types';
import { version } from './version';

export async function scan(scanOptions: ScanOptions, cliArgs?: CliArgs) {
  try {
    await runScan(scanOptions, cliArgs);
  } catch (error) {
    log(LogLevel.ERROR, `An error occurred: ${error}`);
    throw error;
  }
}

async function runScan(scanOptions: ScanOptions, cliArgs?: CliArgs) {
  // Get dependencies from the container
  const {
    serverSupportsJREProvisioning,
    fetchJRE,
    downloadScannerCli,
    runScannerCli,
    fetchScannerEngine,
    runScannerEngine,
    locateExecutableFromPath,
  } = getDeps().scan;

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
  const supportsJREProvisioning = await serverSupportsJREProvisioning(properties);
  log(LogLevel.INFO, `JRE provisioning ${supportsJREProvisioning ? 'is' : 'is NOT'} supported`);

  if (!supportsJREProvisioning) {
    log(LogLevel.INFO, 'Falling back on using sonar-scanner-cli');
    if (scanOptions.localScannerCli) {
      log(LogLevel.INFO, 'Local scanner is requested, will not download sonar-scanner-cli');
      const scannerPath = await locateExecutableFromPath(SCANNER_CLI_DEFAULT_BIN_NAME);
      if (!scannerPath) {
        throw new Error('SonarScanner CLI not found in PATH');
      }
      await runScannerCli(scanOptions, properties, scannerPath);
    } else {
      const binPath = await downloadScannerCli(properties);
      await runScannerCli(scanOptions, properties, binPath);
    }
    return;
  }

  // Detect what Java to use (in path, specified from properties or provisioned)
  let javaPath: string;
  if (properties[ScannerProperty.SonarScannerJavaExePath]) {
    javaPath = properties[ScannerProperty.SonarScannerJavaExePath];
  } else if (properties[ScannerProperty.SonarScannerSkipJreProvisioning] === 'true') {
    const absoluteJavaPath = await locateExecutableFromPath('java');
    if (!absoluteJavaPath) {
      throw new Error('Java not found in PATH');
    }
    javaPath = absoluteJavaPath;
  } else {
    javaPath = await fetchJRE(properties);
  }

  // Fetch the Scanner Engine
  const latestScannerEngine = await fetchScannerEngine(properties);

  // Run the Scanner Engine
  await runScannerEngine(javaPath, latestScannerEngine, scanOptions, properties);
}
