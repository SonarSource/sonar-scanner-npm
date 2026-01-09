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
import fs from 'node:fs';
import path from 'node:path';
import semver, { type SemVer } from 'semver';
import {
  API_OLD_VERSION_ENDPOINT,
  API_V2_JRE_ENDPOINT,
  API_V2_VERSION_ENDPOINT,
  JRE_ALIAS,
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
  type AnalysisJreMetaData,
  type AnalysisJresResponseType,
  CacheStatus,
  type ScannerProperties,
  ScannerProperty,
} from './types';

export interface JavaFsDeps {
  remove: (path: string) => Promise<void>;
}

const defaultFsDeps: JavaFsDeps = {
  remove: (filePath: string) => fs.promises.rm(filePath, { recursive: true, force: true }),
};

export interface JavaDeps {
  fsDeps?: JavaFsDeps;
  fetchFn?: typeof fetch;
  downloadFn?: typeof download;
  getCacheFileLocationFn?: typeof getCacheFileLocation;
  getCacheDirectoriesFn?: typeof getCacheDirectories;
  validateChecksumFn?: typeof validateChecksum;
  extractArchiveFn?: typeof extractArchive;
}

export async function fetchServerVersion(
  properties: ScannerProperties,
  deps: JavaDeps = {},
): Promise<SemVer> {
  const { fetchFn = fetch } = deps;

  let version: SemVer | null = null;
  try {
    // Try and fetch the new version endpoint first
    log(LogLevel.DEBUG, `Fetching API V2 ${API_V2_VERSION_ENDPOINT}`);
    const response = await fetchFn<string>({
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
      const response = await fetchFn<string>({
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
  deps: JavaDeps = {},
): Promise<boolean> {
  if (properties[ScannerProperty.SonarScannerInternalIsSonarCloud] === 'true') {
    return true;
  }

  // SonarQube
  log(LogLevel.DEBUG, 'Detecting SonarQube server version');
  const SQServerInfo =
    semver.coerce(properties[ScannerProperty.SonarScannerInternalSqVersion]) ??
    (await fetchServerVersion(properties, deps));
  log(LogLevel.INFO, 'SonarQube server version:', SQServerInfo.version);

  const supports = semver.satisfies(SQServerInfo, `>=${SONARQUBE_JRE_PROVISIONING_MIN_VERSION}`);
  log(LogLevel.DEBUG, `SonarQube Server v${SQServerInfo} supports JRE provisioning: ${supports}`);
  return supports;
}

export async function fetchJRE(
  properties: ScannerProperties,
  deps: JavaDeps = {},
): Promise<string> {
  const {
    fsDeps = defaultFsDeps,
    fetchFn = fetch,
    downloadFn = download,
    getCacheFileLocationFn = getCacheFileLocation,
    getCacheDirectoriesFn = getCacheDirectories,
    validateChecksumFn = validateChecksum,
    extractArchiveFn = extractArchive,
  } = deps;

  log(LogLevel.DEBUG, 'Detecting latest version of JRE');
  const jreMetaData = await fetchLatestSupportedJRE(properties, fetchFn);
  log(LogLevel.DEBUG, 'Latest Supported JRE: ', jreMetaData);

  log(LogLevel.DEBUG, 'Looking for Cached JRE');
  const cachedJrePath = await getCacheFileLocationFn(properties, {
    checksum: jreMetaData.sha256,
    filename: jreMetaData.filename,
    alias: JRE_ALIAS,
  });
  properties[ScannerProperty.SonarScannerWasJreCacheHit] = cachedJrePath
    ? CacheStatus.Hit
    : CacheStatus.Miss;
  if (cachedJrePath) {
    log(LogLevel.INFO, 'Using JRE from the cache');
    return path.join(cachedJrePath + UNARCHIVE_SUFFIX, jreMetaData.javaPath);
  }

  // JRE not found in cache. Download it.
  const { archivePath, unarchivePath: jreDirPath } = await getCacheDirectoriesFn(properties, {
    checksum: jreMetaData.sha256,
    filename: jreMetaData.filename,
    alias: JRE_ALIAS,
  });

  // If the JRE has a download URL, download it
  const url = jreMetaData.downloadUrl ?? `${API_V2_JRE_ENDPOINT}/${jreMetaData.id}`;

  log(LogLevel.DEBUG, `Starting download of ${JRE_ALIAS}`);
  await downloadFn(url, archivePath);
  log(LogLevel.INFO, `Downloaded ${JRE_ALIAS} to ${archivePath}`);

  try {
    await validateChecksumFn(archivePath, jreMetaData.sha256);
  } catch (error) {
    await fsDeps.remove(archivePath);
    throw error;
  }
  await extractArchiveFn(archivePath, jreDirPath);
  return path.join(jreDirPath, jreMetaData.javaPath);
}

async function fetchLatestSupportedJRE(
  properties: ScannerProperties,
  fetchFn: typeof fetch = fetch,
): Promise<AnalysisJreMetaData> {
  const os = properties[ScannerProperty.SonarScannerOs];
  const arch = properties[ScannerProperty.SonarScannerArch];

  log(LogLevel.DEBUG, `Downloading JRE information for ${os} ${arch} from ${API_V2_JRE_ENDPOINT}`);

  const { data } = await fetchFn<AnalysisJresResponseType>({
    url: API_V2_JRE_ENDPOINT,
    params: {
      os,
      arch,
    },
  });

  if (data.length === 0) {
    throw new Error(`No JREs available for your platform ${os} ${arch}`);
  }

  return data[0];
}
