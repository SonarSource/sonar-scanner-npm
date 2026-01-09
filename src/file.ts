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
import AdmZip from 'adm-zip';
import crypto from 'node:crypto';
import fsExtra from 'fs-extra';
import path from 'node:path';
import tarStream from 'tar-stream';
import zlib from 'node:zlib';
import { SONAR_CACHE_DIR, UNARCHIVE_SUFFIX } from './constants';
import { defaultFsDeps, FsDeps } from './deps';
import { LogLevel, log } from './logging';
import { CacheFileData, ScannerProperties, ScannerProperty } from './types';

export async function getCacheFileLocation(
  properties: ScannerProperties,
  { checksum, filename, alias }: CacheFileData,
  fsDeps: FsDeps = defaultFsDeps,
) {
  const filePath = path.join(getParentCacheDirectory(properties), checksum, filename);
  if (fsDeps.existsSync(filePath)) {
    log(LogLevel.DEBUG, alias, 'version found in cache:', filename);

    // validate cache
    try {
      await validateChecksum(filePath, checksum, fsDeps);
    } catch (error) {
      await fsDeps.remove(filePath);
      throw error;
    }

    return filePath;
  } else {
    log(LogLevel.INFO, `No Cache found for ${alias}`);
    return null;
  }
}

export async function extractArchive(
  fromPath: string,
  toPath: string,
  fsDeps: FsDeps = defaultFsDeps,
) {
  log(LogLevel.DEBUG, `Extracting ${fromPath} to ${toPath}`);
  if (fromPath.endsWith('.tar.gz')) {
    const tarFilePath = fromPath;
    const extract = tarStream.extract();

    const extractionPromise = new Promise((resolve, reject) => {
      extract.on('entry', async (header, stream, next) => {
        // Create the full path for the file
        const filePath = path.join(toPath, header.name);

        // Ensure the parent directory exists
        await fsExtra.ensureDir(path.dirname(filePath));

        stream.pipe(fsDeps.createWriteStream(filePath, { mode: header.mode }));
        stream.on('end', next); // End of file, move onto next file
        stream.resume(); // Auto drain the stream
      });

      extract.on('finish', () => {
        resolve(null);
      });

      extract.on('error', err => {
        log(LogLevel.ERROR, 'Error extracting tar.gz', err);
        reject(err as Error);
      });
    });

    const readStream = fsDeps.createReadStream(tarFilePath);
    const gunzip = zlib.createGunzip();
    const nextStep = readStream.pipe(gunzip);
    nextStep.pipe(extract);

    await extractionPromise;
  } else {
    const zip = new AdmZip(fromPath);
    zip.extractAllTo(toPath, true, true);
  }
}

async function generateChecksum(filepath: string, fsDeps: FsDeps = defaultFsDeps) {
  return new Promise((resolve, reject) => {
    fsDeps.readFile(filepath, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(crypto.createHash('sha256').update(data).digest('hex'));
    });
  });
}

export async function validateChecksum(
  filePath: string,
  expectedChecksum: string,
  fsDeps: FsDeps = defaultFsDeps,
) {
  if (expectedChecksum) {
    log(LogLevel.DEBUG, `Verifying checksum ${expectedChecksum}`);
    const checksum = await generateChecksum(filePath, fsDeps);

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
  fsDeps: FsDeps = defaultFsDeps,
) {
  const archivePath = path.join(getParentCacheDirectory(properties), checksum, filename);
  const unarchivePath = path.join(
    getParentCacheDirectory(properties),
    checksum,
    filename + UNARCHIVE_SUFFIX,
  );

  // Create destination directory if it doesn't exist
  const parentCacheDirectory = path.dirname(unarchivePath);
  if (!fsDeps.existsSync(parentCacheDirectory)) {
    log(LogLevel.DEBUG, `Creating Cache directory as it doesn't exist: ${parentCacheDirectory}`);
    fsDeps.mkdirSync(parentCacheDirectory, { recursive: true });
  }

  return { archivePath, unarchivePath };
}

function getParentCacheDirectory(properties: ScannerProperties) {
  return path.join(properties[ScannerProperty.SonarUserHome], SONAR_CACHE_DIR);
}
