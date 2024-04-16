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
import axios, { AxiosRequestConfig } from 'axios';
import semver, { SemVer } from 'semver';
import {
  API_OLD_VERSION_ENDPOINT,
  API_V2_VERSION_ENDPOINT,
  SONARCLOUD_PRODUCTION_URL,
  SONARCLOUD_URL,
  SONARCLOUD_URL_REGEX,
  SONARQUBE_JRE_PROVISIONING_MIN_VERSION,
} from './constants';
import { downloadFile } from './download';
import { JreMetaData, PlatformInfo, ScannerProperties, ScannerProperty } from './types';
import { fetch } from './request';

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
  const SQServerInfo = await fetchServerVersion(
    sonarHostUrl,
    parameters[ScannerProperty.SonarToken],
  );
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

async function fetchServerVersion(sonarHostUrl: string, token: string): Promise<SemVer> {
  let version: SemVer | null = null;
  try {
    // Try and fetch the new version endpoint first
    log(LogLevel.DEBUG, `Fetching API V2 ${API_V2_VERSION_ENDPOINT}`);
    const response = await fetch(token, { url: sonarHostUrl + API_V2_VERSION_ENDPOINT });
    version = semver.coerce(response.data);
  } catch (error: unknown) {
    try {
      // If it fails, fallback on deprecated server version endpoint
      log(
        LogLevel.DEBUG,
        `Unable to fetch API V2 ${API_V2_VERSION_ENDPOINT}: ${error}. Falling back on ${API_OLD_VERSION_ENDPOINT}`,
      );
      const response = await fetch(token, { url: sonarHostUrl + API_OLD_VERSION_ENDPOINT });
      version = semver.coerce(response.data);
    } catch (error: unknown) {
      // If it also failed, give up
      log(LogLevel.ERROR, `Failed to fetch server version: ${error}`);
      throw error;
    }
  }

  // If we couldn't parse the version
  if (!version) {
    throw new Error(`Failed to parse server version "${version}"`);
  }

  return version;
}
