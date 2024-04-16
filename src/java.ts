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

import { log, LogLevel } from './logging';
import axios from 'axios';
import semver, { SemVer } from 'semver';
import {
  SONARCLOUD_PRODUCTION_URL,
  SONARCLOUD_URL,
  SONARCLOUD_URL_REGEX,
  SONARQUBE_JRE_PROVISIONING_MIN_VERSION,
} from './constants';
import { downloadFile } from './download';
import { JreMetaData, PlatformInfo, ScannerProperties, ScannerProperty } from './types';

function getEndpoint(parameters: ScannerProperties): {
  isSonarCloud: boolean;
  sonarHostUrl: string;
} {
  let sonarHostUrl = parameters[ScannerProperty.SonarHostUrl] ?? '';
  if (!sonarHostUrl || SONARCLOUD_URL_REGEX.exec(sonarHostUrl)) {
    return {
      isSonarCloud: true,
      sonarHostUrl: parameters[ScannerProperty.SonarScannerSonarCloudURL] ?? SONARCLOUD_URL,
    };
  }
  return {
    isSonarCloud: false,
    sonarHostUrl,
  };
}

export async function serverSupportsJREProvisioning(
  parameters: ScannerProperties,
  platformInfo: PlatformInfo,
): Promise<boolean> {
  const { isSonarCloud, sonarHostUrl } = getEndpoint(parameters);

  if (isSonarCloud) {
    return true;
  }

  // SonarQube
  log(LogLevel.DEBUG, 'Detecting SonarQube server version');
  const SQServerInfo = await fetchServerVersion(sonarHostUrl);
  log(LogLevel.INFO, 'SonarQube server version: ', SQServerInfo.version);

  const supports = semver.satisfies(SQServerInfo, `>=${SONARQUBE_JRE_PROVISIONING_MIN_VERSION}`);
  log(LogLevel.DEBUG, `SonarQube Server v${SQServerInfo} supports JRE provisioning: ${supports}`);
  return supports;
}

export async function fetchLatestSupportedJRE(serverUrl: string, platformInfo: PlatformInfo) {
  const jreInfoUrl = `${serverUrl}/api/v2/analysis/jres?os=${platformInfo.os}&arch=${platformInfo.arch}`;
  log(LogLevel.DEBUG, `Downloading JRE from: ${jreInfoUrl}`);

  const { data } = await axios.get<JreMetaData>(jreInfoUrl);

  log(LogLevel.DEBUG, 'file info: ', data);

  return data;
}

async function fetchServerVersion(serverUrl: string): Promise<SemVer> {
  try {
    log(LogLevel.DEBUG, 'Fetch URL: ', `${serverUrl}/api/server/version`);
    const { data } = await axios.get(`${serverUrl}/api/server/version`);
    log(LogLevel.DEBUG, 'Server version:', data);
    return semver.coerce(data) ?? Promise.reject('Unsupported SQ version');
  } catch (e) {
    log(LogLevel.ERROR, 'Failed to fetch server version');
    return Promise.reject(e);
  }
}
