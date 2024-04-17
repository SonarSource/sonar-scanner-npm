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

import fs from 'fs';
import * as fsExtra from 'fs-extra';
import path from 'path';
import axios, { AxiosRequestConfig } from 'axios';
import crypto from 'crypto';
import * as stream from 'stream';
import tarStream from 'tar-stream';
import { promisify } from 'util';
import semver, { SemVer } from 'semver';
import { log, LogLevel } from './logging';
import {
  API_OLD_VERSION_ENDPOINT,
  API_V2_JRE_ENDPOINT,
  API_V2_VERSION_ENDPOINT,
  SONAR_CACHE_DIR,
  SONARCLOUD_PRODUCTION_URL,
  SONARCLOUD_URL,
  SONARCLOUD_URL_REGEX,
  SONARQUBE_JRE_PROVISIONING_MIN_VERSION,
  UNARCHIVE_SUFFIX,
} from './constants';
import {
  JREFullData,
  JreMetaData,
  PlatformInfo,
  ScannerProperties,
  ScannerProperty,
} from './types';
import { fetch } from './request';

const finished = promisify(stream.finished);

export function getEndpoint(parameters: ScannerProperties): {
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

export async function handleJREProvisioning(
  properties: ScannerProperties,
  platformInfo: PlatformInfo,
): Promise<JREFullData> {
  // TODO: use correct mapping to SC/SQ
  const serverUrl = properties[ScannerProperty.SonarHostUrl] ?? SONARCLOUD_PRODUCTION_URL;
  const token = properties[ScannerProperty.SonarToken];

  log(LogLevel.DEBUG, 'Detecting latest version of JRE');
  const latestJREData = await fetchLatestSupportedJRE(serverUrl, platformInfo);
  log(LogLevel.INFO, 'Latest Supported JRE: ', latestJREData);

  log(LogLevel.DEBUG, 'Looking for Cached JRE');
  const cachedJRE = await getCachedFileLocation(
    latestJREData.md5,
    latestJREData.filename + UNARCHIVE_SUFFIX,
  );

  if (cachedJRE) {
    return {
      ...latestJREData,
      jrePath: path.join(cachedJRE, cachedJRE),
    };
  } else {
    const archivePath = path.join(SONAR_CACHE_DIR, latestJREData.md5, latestJREData.filename);
    const jreDirPath = path.join(
      SONAR_CACHE_DIR,
      latestJREData.md5,
      latestJREData.filename + UNARCHIVE_SUFFIX,
    );
    const writer = fs.createWriteStream(archivePath);

    // TODO: fetch JRE
    const url = serverUrl + API_V2_JRE_ENDPOINT + `/${latestJREData.filename}`;
    log(LogLevel.DEBUG, `Downloading ${url} to ${archivePath}`);
    const response = await fetch(token, {
      url,
    });

    response.data.pipe(writer);

    await finished(writer);

    await validateChecksum(archivePath, latestJREData.md5);

    // await extractArchive(archivePath, jreDirPath);

    const jreBinPath = path.join(jreDirPath, latestJREData.javaPath);
    log(LogLevel.DEBUG, `JRE downloaded to ${jreDirPath}. Allowing execution on ${jreBinPath}`);

    return {
      ...latestJREData,
      jrePath: jreBinPath,
    };
  }
}

async function generateChecksum(filepath: string) {
  return new Promise((resolve, reject) => {
    fs.readFile(filepath, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(crypto.createHash('md5').update(data).digest('hex'));
    });
  });
}

async function validateChecksum(filePath: string, expectedChecksum: string) {
  if (expectedChecksum) {
    log(LogLevel.INFO, `Verifying checksum ${expectedChecksum}`);
    const checksum = await generateChecksum(filePath);

    log(LogLevel.DEBUG, `Checksum Value: ${checksum}`);
    if (checksum !== expectedChecksum) {
      throw new Error(
        `Checksum verification failed for ${filePath}. Expected checksum ${expectedChecksum} but got ${checksum}`,
      );
    }
  }
}

async function getCachedFileLocation(md5: string, filename: string) {
  const filePath = path.join(SONAR_CACHE_DIR, md5, filename);
  if (fs.existsSync(path.join(SONAR_CACHE_DIR, md5, filename))) {
    log(LogLevel.INFO, 'Found Cached JRE: ', filePath);
    return filePath;
  }
  log(LogLevel.INFO, 'No Cached JRE found');
}

export async function fetchServerVersion(sonarHostUrl: string, token: string): Promise<SemVer> {
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
