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

import AdmZip from 'adm-zip';
import crypto from 'crypto';
import fs from 'fs';
import * as fsExtra from 'fs-extra';
import path from 'path';
import tarStream from 'tar-stream';
import zlib from 'zlib';
import { SONAR_CACHE_DIR, UNARCHIVE_SUFFIX } from './constants';
import { LogLevel, log } from './logging';
import { CacheFileData, ScannerProperties, ScannerProperty } from './types';

// prevent Zip Bomb attacks
// https://sonarcloud.io/project/security_hotspots?id=SonarSource_sonar-scanner-npm&pullRequest=141&hotspots=AY9ce2j1rNHifkb_WkwD
const MAX_FILES = 10000;
const MAX_SIZE = 1000000000; // 1 GB
const THRESHOLD_RATIO = 10;

export async function getCacheFileLocation(
  properties: ScannerProperties,
  { checksum, filename, alias }: CacheFileData,
) {
  const filePath = path.join(getParentCacheDirectory(properties), checksum, filename);
  if (fs.existsSync(filePath)) {
    log(LogLevel.DEBUG, alias, 'version found in cache:', filename);

    // validate cache
    try {
      await validateChecksum(filePath, checksum);
    } catch (error) {
      await fsExtra.remove(filePath);
      throw error;
    }

    return filePath;
  } else {
    log(LogLevel.INFO, `No Cache found for ${alias}`);
    return null;
  }
}

export async function extractArchive(fromPath: string, toPath: string, canonicalBasePath: string) {
  log(LogLevel.DEBUG, `Extracting ${fromPath} to ${toPath}`);
  if (fromPath.endsWith('.tar.gz')) {
    const tarFilePath = fromPath;
    const extract = tarStream.extract();

    const extractionPromise = new Promise((resolve, reject) => {
      extract.on('entry', async (header, stream, next) => {
        // Create the full path for the file
        const filePath = path.join(toPath, header.name);

        // Ensure the directory exists
        await fsExtra.ensureDir(path.dirname(filePath));

        // prevent zip slip security issue
        // https://sonarcloud.io/project/issues?open=AY9ce2j1rNHifkb_WkwE&id=SonarSource_sonar-scanner-npm
        if (filePath.startsWith(canonicalBasePath)) {
          stream.pipe(fs.createWriteStream(filePath, { mode: header.mode }));
        }

        // end of file, move onto next file
        stream.on('end', next);

        stream.resume(); // just auto drain the stream
      });

      extract.on('finish', () => {
        resolve(null);
      });

      extract.on('error', err => {
        log(LogLevel.ERROR, 'Error extracting tar.gz', err);
        reject(err as Error);
      });
    });

    const readStream = fs.createReadStream(tarFilePath);
    const gunzip = zlib.createGunzip();
    const nextStep = readStream.pipe(gunzip);
    nextStep.pipe(extract);

    await extractionPromise;
  } else {
    let fileCount = 0;
    let totalSize = 0;

    const zip = new AdmZip(fromPath);
    let zipEntries = zip.getEntries();
    zipEntries.forEach(function (zipEntry) {
      fileCount++;
      if (fileCount > MAX_FILES) {
        throw new Error('Reached max. number of files');
      }

      let entrySize = zipEntry.getData().length;
      totalSize += entrySize;
      if (totalSize > MAX_SIZE) {
        throw new Error('Reached max. size');
      }

      let compressionRatio = entrySize / zipEntry.header.compressedSize;
      if (compressionRatio > THRESHOLD_RATIO) {
        throw new Error('Reached max. compression ratio');
      }

      if (!zipEntry.isDirectory) {
        zip.extractEntryTo(zipEntry.entryName, '.', undefined, true, true);
      }
    });
  }
}

async function generateChecksum(filepath: string) {
  return new Promise((resolve, reject) => {
    fs.readFile(filepath, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(crypto.createHash('sha256').update(data).digest('hex'));
    });
  });
}

export async function validateChecksum(filePath: string, expectedChecksum: string) {
  if (expectedChecksum) {
    log(LogLevel.DEBUG, `Verifying checksum ${expectedChecksum}`);
    const checksum = await generateChecksum(filePath);

    log(LogLevel.DEBUG, `Checksum Value: ${checksum}`);
    if (checksum !== expectedChecksum) {
      throw new Error(
        `Checksum verification failed for ${filePath}. Expected checksum ${expectedChecksum} but got ${checksum}`,
      );
    }
  } else {
    throw new Error('Checksum not provided');
  }
}

export async function getCacheDirectories(
  properties: ScannerProperties,
  { checksum, filename }: CacheFileData,
) {
  const archivePath = path.join(getParentCacheDirectory(properties), checksum, filename);
  const unarchivePath = path.join(
    getParentCacheDirectory(properties),
    checksum,
    filename + UNARCHIVE_SUFFIX,
  );

  // Create destination directory if it doesn't exist
  const parentCacheDirectory = path.dirname(unarchivePath);
  if (!fs.existsSync(parentCacheDirectory)) {
    log(LogLevel.DEBUG, `Creating Cache directory as it doesn't exist: ${parentCacheDirectory}`);
    fs.mkdirSync(parentCacheDirectory, { recursive: true });
  }

  return { archivePath, unarchivePath };
}

export function getParentCacheDirectory(properties: ScannerProperties) {
  return path.join(properties[ScannerProperty.SonarUserHome], SONAR_CACHE_DIR);
}
