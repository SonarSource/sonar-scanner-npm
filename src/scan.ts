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

import { version } from '../package.json';
import { SCANNER_CLI_DEFAULT_BIN_NAME } from './constants';
import { fetchJRE, serverSupportsJREProvisioning } from './java';
import { LogLevel, log, setLogLevel } from './logging';
import { getPlatformInfo } from './platform';
import { getProperties } from './properties';
import { initializeAxios } from './request';
import { downloadScannerCli, runScannerCli, tryLocalSonarScannerExecutable } from './scanner-cli';
import { fetchScannerEngine } from './scanner-engine';
import { ScanOptions, ScannerProperty } from './types';

export async function scan(scanOptions: ScanOptions, cliArgs?: string[]) {
  try {
    await runScan(scanOptions, cliArgs);
  } catch (error: any) {
    log(LogLevel.ERROR, `An error occurred: ${error?.message ?? error}`);
  }
}

async function runScan(scanOptions: ScanOptions, cliArgs?: string[]) {
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

  initializeAxios(properties);

  log(LogLevel.INFO, `Server URL: ${properties[ScannerProperty.SonarHostUrl]}`);
  log(LogLevel.INFO, `Version: ${version}`);

  log(LogLevel.DEBUG, 'Finding platform info');
  const platformInfo = getPlatformInfo();
  log(LogLevel.INFO, 'Platform: ', platformInfo);

  log(LogLevel.DEBUG, 'Check if Server supports JRE Provisioning');
  const supportsJREProvisioning = await serverSupportsJREProvisioning(properties);
  log(LogLevel.INFO, `JRE Provisioning ${supportsJREProvisioning ? 'is' : 'is NOT'} supported`);

  if (!supportsJREProvisioning) {
    log(LogLevel.INFO, 'Will download and use sonar-scanner-cli');
    if (scanOptions.localScannerCli) {
      log(LogLevel.INFO, 'Local scanner is requested, will not download sonar-scanner-cli');
      if (!(await tryLocalSonarScannerExecutable(SCANNER_CLI_DEFAULT_BIN_NAME))) {
        throw new Error('Local scanner is requested but not found');
      }
      await runScannerCli(scanOptions, properties, SCANNER_CLI_DEFAULT_BIN_NAME);
    } else {
      const binPath = await downloadScannerCli(properties);
      await runScannerCli(scanOptions, properties, binPath);
    }
    return;
  }

  // TODO: also check if JRE is explicitly set by properties
  const explicitJREPathOverride = properties[ScannerProperty.SonarScannerJavaExePath];
  const latestJRE = explicitJREPathOverride ?? (await fetchJRE(properties, platformInfo));
  const latestScannerEngine = await fetchScannerEngine(properties);

  //TODO: run the scanner..

  log(LogLevel.INFO, 'Running the scanner ...');
}
