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

import { handleJREProvisioning, serverSupportsJREProvisioning } from './java';
import { log, LogLevel, setLogLevel } from './logging';
import { getPlatformInfo } from './platform';
import { getProperties } from './properties';
import { ScannerProperty, JreMetaData, ScanOptions } from './types';
import { version } from '../package.json';

export async function scan(scanOptions: ScanOptions, cliArgs?: string[]) {
  const startTimestampMs = Date.now();
  const properties = getProperties(scanOptions, startTimestampMs, cliArgs);

  const serverUrl = properties[ScannerProperty.SonarHostUrl];
  const explicitJREPathOverride = properties[ScannerProperty.SonarScannerJavaExePath];

  if (properties[ScannerProperty.SonarVerbose] === 'true') {
    setLogLevel(LogLevel.DEBUG);
    log(LogLevel.DEBUG, 'Setting the log level to DEBUG due to verbose mode');
  }

  if (properties[ScannerProperty.SonarLogLevel]) {
    setLogLevel(properties[ScannerProperty.SonarLogLevel]);
    log(LogLevel.DEBUG, `Overriding the log level to ${properties[ScannerProperty.SonarLogLevel]}`);
  }

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
  let latestJRE: string | JreMetaData = explicitJREPathOverride || 'java';
  if (!explicitJREPathOverride && supportsJREProvisioning) {
    await handleJREProvisioning(properties, platformInfo);
  } else {
    // TODO: old SQ, support old CLI fetch
    // https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-${version}-${os}.zip
  }

  //TODO: verifyScannerEngine

  //TODO: fetchScannerEngine

  //TODO:
  // ...
  properties[ScannerProperty.SonarScannerWasEngineCacheHit] = 'false';
  // ...
}
