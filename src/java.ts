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

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import semver, { SemVer } from 'semver';
import * as stream from 'stream';
import { promisify } from 'util';
import zlib from 'zlib';
import {
  API_OLD_VERSION_ENDPOINT,
  API_V2_JRE_ENDPOINT,
  API_V2_VERSION_ENDPOINT,
  SONAR_CACHE_DIR,
  SONARCLOUD_PRODUCTION_URL,
  SONARQUBE_JRE_PROVISIONING_MIN_VERSION,
  UNARCHIVE_SUFFIX,
} from './constants';
import { getHttpAgents } from './http-agent';
import { log, LogLevel } from './logging';
import { getProxyUrl } from './proxy';
import { fetch } from './request';
import {
  JREFullData,
  JreMetaData,
  PlatformInfo,
  ScannerProperties,
  ScannerProperty,
} from './types';
import { extractArchive, getCachedFileLocation } from './file';

const finished = promisify(stream.finished);

export async function serverSupportsJREProvisioning(
  parameters: ScannerProperties,
): Promise<boolean> {
  if (parameters[ScannerProperty.SonarScannerInternalIsSonarCloud] !== 'true') {
    return true;
  }

  // SonarQube
  log(LogLevel.DEBUG, 'Detecting SonarQube server version');
  const SQServerInfo =
    semver.coerce(parameters[ScannerProperty.SonarScannerInternalSqVersion]) ??
    (await fetchServerVersion(parameters[ScannerProperty.SonarHostUrl], parameters));
  log(LogLevel.INFO, 'SonarQube server version: ', SQServerInfo.version);

  const supports = semver.satisfies(SQServerInfo, `>=${SONARQUBE_JRE_PROVISIONING_MIN_VERSION}`);
  log(LogLevel.DEBUG, `SonarQube Server v${SQServerInfo} supports JRE provisioning: ${supports}`);
  return supports;
}

async function fetchLatestSupportedJRE(properties: ScannerProperties, platformInfo: PlatformInfo) {
  // TODO: enforce correct mapping to SC/SQ
  const serverUrl = properties[ScannerProperty.SonarHostUrl] ?? SONARCLOUD_PRODUCTION_URL;
  const token = properties[ScannerProperty.SonarToken];

  const jreInfoUrl = `${serverUrl}/api/v2/analysis/jres?os=${platformInfo.os}&arch=${platformInfo.arch}`;
  log(LogLevel.DEBUG, `Downloading JRE from: ${jreInfoUrl}`);

  const { data } = await fetch(token, { url: jreInfoUrl });

  log(LogLevel.DEBUG, 'file info: ', data);

  return data;
}

export async function handleJREProvisioning(
  properties: ScannerProperties,
  platformInfo: PlatformInfo,
): Promise<JREFullData | undefined> {
  // TODO: use correct mapping to SC/SQ
  const serverUrl = properties[ScannerProperty.SonarHostUrl] ?? SONARCLOUD_PRODUCTION_URL;
  const token = properties[ScannerProperty.SonarToken];

  log(LogLevel.DEBUG, 'Detecting latest version of JRE');
  const latestJREData = await fetchLatestSupportedJRE(properties, platformInfo);
  log(LogLevel.INFO, 'Latest Supported JRE: ', latestJREData);

  log(LogLevel.DEBUG, 'Looking for Cached JRE');
  const cachedJRE = await getCachedFileLocation(
    latestJREData.md5,
    latestJREData.filename + UNARCHIVE_SUFFIX,
  );

  const proxyUrl = getProxyUrl(properties);

  if (cachedJRE) {
    log(LogLevel.INFO, 'Using Cached JRE');
    properties[ScannerProperty.SonarScannerWasJRECacheHit] = 'true';

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

    log(LogLevel.DEBUG, `Extracting JRE from: ${archivePath}`);
    log(LogLevel.DEBUG, `Extracting JRE to: ${jreDirPath}`);
    // Create destination directory if it doesn't exist
    const parentCacheDirectory = jreDirPath.substring(0, jreDirPath.lastIndexOf('/'));
    if (!fs.existsSync(parentCacheDirectory)) {
      log(LogLevel.DEBUG, `Cache directory doesn't exist: ${parentCacheDirectory}`);
      log(LogLevel.DEBUG, `Creating cache directory`);
      fs.mkdirSync(parentCacheDirectory, { recursive: true });
    }
    const writer = fs.createWriteStream(archivePath);

    const url = serverUrl + API_V2_JRE_ENDPOINT + `/${latestJREData.filename}`;
    log(LogLevel.DEBUG, `Downloading ${url} to ${archivePath}`);

    const response = await fetch(token, {
      url,
      method: 'GET',
      responseType: 'stream',
      ...getHttpAgents(proxyUrl),
    });

    const totalLength = response.headers['content-length'];
    let progress = 0;

    response.data.on('data', (chunk: any) => {
      progress += chunk.length;
      process.stdout.write(
        `\r[INFO] Bootstrapper::  Downloaded ${Math.round((progress / totalLength) * 100)}%`,
      );
    });

    response.data.on('end', () => {
      console.log();
      log(LogLevel.INFO, 'JRE Download complete');
    });

    const streamPipeline = promisify(stream.pipeline);
    await streamPipeline(response.data, writer);

    response.data.pipe(writer);

    await finished(writer);
    log(LogLevel.INFO, `Downloaded JRE to ${archivePath}`);

    await validateChecksum(archivePath, latestJREData.md5);

    log(LogLevel.INFO, `Extracting JRE to ${jreDirPath}`);
    await extractArchive(archivePath, jreDirPath);

    const jreBinPath = path.join(jreDirPath, latestJREData.javaPath);

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

export async function fetchServerVersion(
  sonarHostUrl: string,
  parameters: ScannerProperties,
): Promise<SemVer> {
  const token = parameters[ScannerProperty.SonarToken];
  const proxyUrl = getProxyUrl(parameters);
  let version: SemVer | null = null;
  try {
    // Try and fetch the new version endpoint first
    log(LogLevel.DEBUG, `Fetching API V2 ${API_V2_VERSION_ENDPOINT}`);
    const response = await fetch(token, {
      url: sonarHostUrl + API_V2_VERSION_ENDPOINT,
      ...getHttpAgents(proxyUrl),
    });
    version = semver.coerce(response.data);
  } catch (error: unknown) {
    try {
      // If it fails, fallback on deprecated server version endpoint
      log(
        LogLevel.DEBUG,
        `Unable to fetch API V2 ${API_V2_VERSION_ENDPOINT}: ${error}. Falling back on ${API_OLD_VERSION_ENDPOINT}`,
      );
      const response = await fetch(token, {
        url: sonarHostUrl + API_OLD_VERSION_ENDPOINT,
        ...getHttpAgents(proxyUrl),
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
