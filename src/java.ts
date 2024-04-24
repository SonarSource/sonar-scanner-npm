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

import path from 'path';
import semver, { SemVer } from 'semver';
import {
  API_OLD_VERSION_ENDPOINT,
  API_V2_JRE_ENDPOINT,
  API_V2_VERSION_ENDPOINT,
  SONARQUBE_JRE_PROVISIONING_MIN_VERSION,
  UNARCHIVE_SUFFIX,
} from './constants';
import {
  extractArchive,
  getCacheDirectories,
  getCacheFileLocation,
  validateChecksum,
} from './file';
import { log, LogLevel } from './logging';
import { download, fetch } from './request';
import { PlatformInfo, ScannerProperties, ScannerProperty } from './types';

export async function fetchServerVersion(): Promise<SemVer> {
  let version: SemVer | null = null;
  try {
    // Try and fetch the new version endpoint first
    log(LogLevel.DEBUG, `Fetching API V2 ${API_V2_VERSION_ENDPOINT}`);
    const response = await fetch({
      url: API_V2_VERSION_ENDPOINT,
    });
    version = semver.coerce(response.data);
  } catch (error: unknown) {
    try {
      // If it fails, fallback on deprecated server version endpoint
      log(
        LogLevel.DEBUG,
        `Unable to fetch API V2 ${API_V2_VERSION_ENDPOINT}: ${error}. Falling back on ${API_OLD_VERSION_ENDPOINT}`,
      );
      const response = await fetch({
        url: API_OLD_VERSION_ENDPOINT,
      });
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

export async function serverSupportsJREProvisioning(
  parameters: ScannerProperties,
): Promise<boolean> {
  if (parameters[ScannerProperty.SonarScannerInternalIsSonarCloud] === 'true') {
    return true;
  }

  // SonarQube
  log(LogLevel.DEBUG, 'Detecting SonarQube server version');
  const SQServerInfo =
    semver.coerce(parameters[ScannerProperty.SonarScannerInternalSqVersion]) ??
    (await fetchServerVersion());
  log(LogLevel.INFO, 'SonarQube server version: ', SQServerInfo.version);

  const supports = semver.satisfies(SQServerInfo, `>=${SONARQUBE_JRE_PROVISIONING_MIN_VERSION}`);
  log(LogLevel.DEBUG, `SonarQube Server v${SQServerInfo} supports JRE provisioning: ${supports}`);
  return supports;
}

export async function fetchJRE(
  properties: ScannerProperties,
  platformInfo: PlatformInfo,
): Promise<string> {
  log(LogLevel.DEBUG, 'Detecting latest version of JRE');
  const latestJREData = await fetchLatestSupportedJRE(platformInfo);
  log(LogLevel.INFO, 'Latest Supported JRE: ', latestJREData);

  log(LogLevel.DEBUG, 'Looking for Cached JRE');
  const cachedJRE = await getCacheFileLocation(properties, {
    md5: latestJREData.md5,
    filename: latestJREData.filename + UNARCHIVE_SUFFIX,
  });
  if (cachedJRE) {
    log(LogLevel.INFO, 'Using Cached JRE');
    properties[ScannerProperty.SonarScannerWasJRECacheHit] = 'true';

    return path.join(cachedJRE, latestJREData.javaPath);
  } else {
    const { archivePath, unarchivePath: jreDirPath } = await getCacheDirectories(
      properties,
      latestJREData,
    );

    await download(`${API_V2_JRE_ENDPOINT}/${latestJREData.filename}`, archivePath);
    log(LogLevel.INFO, `Downloaded JRE to ${archivePath}`);

    await validateChecksum(archivePath, latestJREData.md5);

    await extractArchive(archivePath, jreDirPath);

    return path.join(jreDirPath, latestJREData.javaPath);
  }
}

async function fetchLatestSupportedJRE(platformInfo: PlatformInfo) {
  log(
    LogLevel.DEBUG,
    `Downloading JRE for ${platformInfo.os} ${platformInfo.arch} from ${API_V2_JRE_ENDPOINT}`,
  );

  const { data } = await fetch({
    url: API_V2_JRE_ENDPOINT,
    params: {
      os: platformInfo.os,
      arch: platformInfo.arch,
    },
  });

  log(LogLevel.DEBUG, 'JRE information: ', data);
  return data;
}
