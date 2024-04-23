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
import path from 'path';
import { log, LogLevel } from './logging';
import { fetch, download } from './request';
import { ScannerProperties, ScannerProperty } from './types';
import { extractArchive, getCachedFileLocation, validateChecksum } from './file';
import { SONAR_CACHE_DIR, UNARCHIVE_SUFFIX } from './constants';

export async function fetchScannerEngine(properties: ScannerProperties) {
  log(LogLevel.DEBUG, 'Detecting latest version of Scanner Engine');
  const { data } = await fetch({
    // TODO: replace with /api/v2/analysis/engine
    url: '/batch/index',
  });
  const [filename, md5] = data.trim().split('|');
  log(LogLevel.INFO, 'Latest Supported Scanner Engine: ', filename);

  log(LogLevel.DEBUG, 'Looking for Cached Scanner Engine');

  const cachedScannerEngine = await getCachedFileLocation(
    md5, // TODO: use sha256
    filename,
  );

  if (cachedScannerEngine) {
    log(LogLevel.INFO, 'Using Cached Scanner Engine');
    properties[ScannerProperty.SonarScannerWasEngineCacheHit] = 'true';

    return cachedScannerEngine;
  }

  properties[ScannerProperty.SonarScannerWasEngineCacheHit] = 'false';
  const archivePath = path.join(SONAR_CACHE_DIR, md5, filename);
  const scannerEnginePath = path.join(SONAR_CACHE_DIR, md5, filename + UNARCHIVE_SUFFIX);

  // Create destination directory if it doesn't exist
  const parentCacheDirectory = scannerEnginePath.substring(0, scannerEnginePath.lastIndexOf('/'));
  if (!fs.existsSync(parentCacheDirectory)) {
    log(LogLevel.DEBUG, `Cache directory doesn't exist: ${parentCacheDirectory}`);
    log(LogLevel.DEBUG, `Creating cache directory`);
    fs.mkdirSync(parentCacheDirectory, { recursive: true });
  }

  // TODO: replace with /api/v2/analysis/engine/<filename>
  log(LogLevel.DEBUG, `Starting download of Scanner Engine`);
  await download(`/batch/file?name=${filename}`, archivePath);
  log(LogLevel.INFO, `Downloaded Scanner Engine to ${scannerEnginePath}`);

  await validateChecksum(archivePath, md5);

  log(LogLevel.INFO, `Extracting Scanner Engine to ${scannerEnginePath}`);
  await extractArchive(archivePath, scannerEnginePath);
  return scannerEnginePath;
}
