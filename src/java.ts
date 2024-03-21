/*
 * sonar-scanner-npm
 * Copyright (C) 2022-2023 SonarSource SA
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
import axios from 'axios';
import path from 'path';
import semver, { SemVer } from 'semver';
import {
  SONARCLOUD_URL,
  SONARQUBE_JRE_PROVISIONING_MIN_VERSION,
  SONAR_CACHE_DIR,
} from './constants';
import { allowExecution, downloadFile, extractArchive } from './download';
import { LogLevel, log } from './logging';
import { JreMetaData, PlatformInfo } from './types';

function supportsJreProvisioning(serverUrl: string, serverVersion: SemVer) {
  // TODO: Is this acceptable? This won't work on squad environments (ok we could use regexp match but still, is this acceptable?)
  if (serverUrl === SONARCLOUD_URL) {
    log(LogLevel.DEBUG, 'SonarCloud detected, and SonarCloud always supports JRE provisioning');
    return true;
  }

  const supports = semver.satisfies(serverVersion, `>=${SONARQUBE_JRE_PROVISIONING_MIN_VERSION}`);
  log(LogLevel.DEBUG, `SonarQube Server v${serverVersion} supports JRE provisioning: ${supports}`);
  return supports;
}

async function downloadJre(
  serverUrl: string,
  platformInfo: PlatformInfo,
): Promise<
  // TODO: Create a type for that?
  JreMetaData & {
    jrePath: string;
  }
> {
  const { data } = await axios.get<JreMetaData>(
    `${serverUrl}/api/v2/scanner/jre/info?os=${platformInfo.os}&arch=${platformInfo.arch}`,
  );

  const archivePath = path.join(SONAR_CACHE_DIR, data.checksum, data.filename);
  const jreDirPath = path.join(SONAR_CACHE_DIR, data.checksum, data.filename + '_unzip');

  await downloadFile(
    `${serverUrl}/api/v2/scanner/jre/download?filename=${data.filename}`,
    archivePath,
  );
  await extractArchive(archivePath, jreDirPath);

  const jreBinPath = path.join(jreDirPath, data.javaPath);
  log(LogLevel.DEBUG, `JRE downloaded to ${jreDirPath}. Allowing execution on ${jreBinPath}`);
  // TODO: check if this is needed, we can also check the file permissions before
  allowExecution(jreBinPath);

  return {
    ...data,
    jrePath: jreBinPath,
  };
}

export async function fetchJre(
  serverUrl: string,
  serverVersion: SemVer,
  platformInfo: PlatformInfo,
): Promise<string> {
  if (supportsJreProvisioning(serverUrl, serverVersion)) {
    const { jrePath } = await downloadJre(serverUrl, platformInfo);
    return jrePath;
  }

  // TODO: Sanity check?

  // TODO: Check that this is acceptable
  return 'java';
}
