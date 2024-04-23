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

import { fetchJRE, serverSupportsJREProvisioning } from './java';
import { fetchScannerEngine } from './scanner-engine';
import { log, LogLevel, setLogLevel } from './logging';
import { getPlatformInfo } from './platform';
import { getProperties } from './properties';
import { ScannerProperty, ScanOptions, JREFullData } from './types';
import { version } from '../package.json';
import { initializeAxios } from './request';

export async function scan(scanOptions: ScanOptions, cliArgs?: string[]) {
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

  const serverUrl = properties[ScannerProperty.SonarHostUrl];
  const explicitJREPathOverride = properties[ScannerProperty.SonarScannerJavaExePath];

  log(LogLevel.INFO, 'Version: ', version);

  log(LogLevel.DEBUG, 'Finding platform info');
  const platformInfo = getPlatformInfo();
  log(LogLevel.INFO, 'Platform: ', platformInfo);

  log(LogLevel.DEBUG, 'Check if Server supports JRE Provisioning');
  const supportsJREProvisioning = await serverSupportsJREProvisioning(properties);
  log(
    LogLevel.INFO,
    `JRE Provisioning ${supportsJREProvisioning ? 'is ' : 'is NOT '}supported on ${serverUrl}`,
  );

  // TODO: also check if JRE is explicitly set by properties
  let latestJRE: string | JREFullData = explicitJREPathOverride || 'java';
  let latestScannerEngine;
  if (!supportsJREProvisioning) {
    // TODO: old SQ, support old CLI fetch
    // https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-${version}-${os}.zip
  }

  if (!explicitJREPathOverride) {
    latestJRE = await fetchJRE(properties, platformInfo);
  }

  latestScannerEngine = await fetchScannerEngine(properties);

  //TODO: run the scanner..
  log(LogLevel.INFO, 'Running the scanner ...');
}
