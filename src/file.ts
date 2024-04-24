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
import { log, LogLevel } from './logging';
import { CacheFileData, ScannerProperties, ScannerProperty } from './types';

export async function getCacheFileLocation(
  properties: ScannerProperties,
  { md5, filename }: CacheFileData,
) {
  const filePath = path.join(getParentCacheDirectory(properties), md5, filename);
  if (fs.existsSync(filePath)) {
    log(LogLevel.INFO, 'Found Cached: ', filePath);
    return filePath;
  } else {
    log(LogLevel.INFO, `No Cache found for ${filePath}`);
    return null;
  }
}

export async function extractArchive(fromPath: string, toPath: string) {
  log(LogLevel.INFO, `Extracting ${fromPath} to ${toPath}`);
  if (fromPath.endsWith('.tar.gz')) {
    const tarFilePath = fromPath;
    const extract = tarStream.extract();

    const extractionPromise = new Promise((resolve, reject) => {
      extract.on('entry', async (header, stream, next) => {
        // Create the full path for the file
        const filePath = path.join(toPath, header.name);

        // Ensure the directory exists
        await fsExtra.ensureDir(path.dirname(filePath));

        stream.pipe(fs.createWriteStream(filePath, { mode: header.mode }));

        stream.on('end', next);

        stream.resume(); // just auto drain the stream
      });

      extract.on('finish', () => {
        resolve(null);
      });

      extract.on('error', err => {
        log(LogLevel.ERROR, 'Error extracting tar.gz', err);
        reject(err);
      });
    });

    fs.createReadStream(tarFilePath).pipe(zlib.createGunzip()).pipe(extract);

    await extractionPromise;
  } else {
    const zip = new AdmZip(fromPath);
    zip.extractAllTo(toPath, true, true);
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

export async function validateChecksum(filePath: string, expectedChecksum: string) {
  if (expectedChecksum) {
    log(LogLevel.INFO, `Verifying checksum ${expectedChecksum}`);
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
  { md5, filename }: CacheFileData,
) {
  const archivePath = path.join(getParentCacheDirectory(properties), md5, filename);
  const unarchivePath = path.join(
    getParentCacheDirectory(properties),
    md5,
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

function getParentCacheDirectory(properties: ScannerProperties) {
  return path.join(properties[ScannerProperty.SonarUserHome], SONAR_CACHE_DIR);
}
