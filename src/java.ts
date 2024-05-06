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
import { LogLevel, log } from './logging';
import { download, fetch } from './request';
import {
  AnalysisJreMetaData,
  AnalysisJresResponseType,
  CacheStatus,
  ScannerProperties,
  ScannerProperty,
} from './types';

export async function fetchServerVersion(properties: ScannerProperties): Promise<SemVer> {
  let version: SemVer | null = null;
  try {
    // Try and fetch the new version endpoint first
    log(LogLevel.DEBUG, `Fetching API V2 ${API_V2_VERSION_ENDPOINT}`);
    const response = await fetch<string>({
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
      const response = await fetch<string>({
        url: `${properties[ScannerProperty.SonarHostUrl]}${API_OLD_VERSION_ENDPOINT}`,
      });
      version = semver.coerce(response.data);
    } catch (error: unknown) {
      // If it also failed, give up
      log(LogLevel.ERROR, `Failed to fetch server version: ${error}`);

      // Inform the user of the host url that has failed, most
      log(
        LogLevel.ERROR,
        `Verify that ${properties[ScannerProperty.SonarHostUrl]} is a valid SonarQube server`,
      );
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
  properties: ScannerProperties,
): Promise<boolean> {
  if (properties[ScannerProperty.SonarScannerInternalIsSonarCloud] === 'true') {
    return true;
  }

  // SonarQube
  log(LogLevel.DEBUG, 'Detecting SonarQube server version');
  const SQServerInfo =
    semver.coerce(properties[ScannerProperty.SonarScannerInternalSqVersion]) ??
    (await fetchServerVersion(properties));
  log(LogLevel.INFO, 'SonarQube server version: ', SQServerInfo.version);

  const supports = semver.satisfies(SQServerInfo, `>=${SONARQUBE_JRE_PROVISIONING_MIN_VERSION}`);
  log(LogLevel.DEBUG, `SonarQube Server v${SQServerInfo} supports JRE provisioning: ${supports}`);
  return supports;
}

export async function fetchJRE(properties: ScannerProperties): Promise<string> {
  log(LogLevel.DEBUG, 'Detecting latest version of JRE');
  const jreMetaData = await fetchLatestSupportedJRE(properties);
  log(LogLevel.DEBUG, 'Latest Supported JRE: ', jreMetaData);

  log(LogLevel.DEBUG, 'Looking for Cached JRE');
  const cachedJrePath = await getCacheFileLocation(properties, {
    checksum: jreMetaData.sha256,
    filename: jreMetaData.filename + UNARCHIVE_SUFFIX,
  });
  properties[ScannerProperty.SonarScannerWasJreCacheHit] = cachedJrePath
    ? CacheStatus.Hit
    : CacheStatus.Miss;
  if (cachedJrePath) {
    log(LogLevel.INFO, 'Using Cached JRE');
    return path.join(cachedJrePath, jreMetaData.javaPath);
  }

  // JRE not found in cache. Download it.
  const { archivePath, unarchivePath: jreDirPath } = await getCacheDirectories(properties, {
    checksum: jreMetaData.sha256,
    filename: jreMetaData.filename,
  });

  // If the JRE has a download URL, download it
  const url = jreMetaData.downloadUrl ?? `${API_V2_JRE_ENDPOINT}/${jreMetaData.id}`;

  await download(url, archivePath);
  await validateChecksum(archivePath, jreMetaData.sha256);
  await extractArchive(archivePath, jreDirPath);
  return path.join(jreDirPath, jreMetaData.javaPath);
}

async function fetchLatestSupportedJRE(
  properties: ScannerProperties,
): Promise<AnalysisJreMetaData> {
  const os = properties[ScannerProperty.SonarScannerOs];
  const arch = properties[ScannerProperty.SonarScannerArch];

  log(LogLevel.DEBUG, `Downloading JRE for ${os} ${arch} from ${API_V2_JRE_ENDPOINT}`);

  const { data } = await fetch<AnalysisJresResponseType>({
    url: API_V2_JRE_ENDPOINT,
    params: {
      os,
      arch,
    },
  });

  if (data.length === 0) {
    throw new Error(`No JREs available for your platform ${os} ${arch}`);
  }

  log(LogLevel.DEBUG, 'JRE Information', data);
  return data[0];
}
