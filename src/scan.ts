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

import { log, LogLevel, setLogLevel } from './logging';
import { getPlatformInfo } from './platform';
import { getProperties } from './properties';
import { ScannerProperty, ScanOptions } from './types';

export async function scan(scanOptions: ScanOptions, cliArgs?: string[]) {
  const startTimestampMs = Date.now();
  const properties = getProperties(scanOptions, startTimestampMs, cliArgs);
  if (properties[ScannerProperty.SonarVerbose] === 'true') {
    setLogLevel(LogLevel.DEBUG);
    log(LogLevel.DEBUG, 'Setting the log level to DEBUG due to verbose mode');
  }

  log(LogLevel.DEBUG, 'Finding platform info');
  const platformInfo = getPlatformInfo();
  log(LogLevel.INFO, 'Platform: ', platformInfo);

  //TODO: verifyJRE based on platform
  //TODO: fetchJRE
  //TODO: verifyScannerEngine
  //TODO: fetchScannerEngine
  //TODO:
  // ...
  properties[ScannerProperty.SonarScannerWasEngineCacheHit] = 'false';
  // ...
}
