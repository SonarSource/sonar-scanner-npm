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
import path from 'node:path';
import tarStream from 'tar-stream';
import zlib from 'node:zlib';
import { SONAR_CACHE_DIR, UNARCHIVE_SUFFIX } from './constants';
import { getDeps } from './deps';
import { LogLevel, log } from './logging';
import { type CacheFileData, type ScannerProperties, ScannerProperty } from './types';

export async function getCacheFileLocation(
  properties: ScannerProperties,
  { checksum, filename, alias }: CacheFileData,
) {
  const { fs } = getDeps();
  const filePath = path.join(getParentCacheDirectory(properties), checksum, filename);
  if (fs.existsSync(filePath)) {
    log(LogLevel.DEBUG, alias, 'version found in cache:', filename);

    // validate cache
    try {
      await validateChecksum(filePath, checksum);
    } catch (error) {
      await fs.remove(filePath);
      throw error;
    }

    return filePath;
  } else {
    log(LogLevel.INFO, `No Cache found for ${alias}`);
    return null;
  }
}

export async function extractArchive(fromPath: string, toPath: string) {
  const { fs } = getDeps();
  log(LogLevel.DEBUG, `Extracting ${fromPath} to ${toPath}`);
  if (fromPath.endsWith('.tar.gz')) {
    const tarFilePath = fromPath;
    const extract = tarStream.extract();

    const extractionPromise = new Promise((resolve, reject) => {
      extract.on('entry', async (header, stream, next) => {
        const canonicalPath = path.normalize(toPath + path.sep + header.name);

        // Prevent Zip Slip vulnerability by ensuring the path is within the target directory
        if (!canonicalPath.startsWith(toPath)) {
          stream.resume();
          reject(new Error(`Entry "${header.name}" would extract outside target directory`));
          return;
        }

        // Ensure the parent directory exists
        fs.mkdirSync(path.dirname(canonicalPath), { recursive: true });

        stream.pipe(fs.createWriteStream(canonicalPath, { mode: header.mode }));
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

    const readStream = fs.createReadStream(tarFilePath);
    const gunzip = zlib.createGunzip();
    const nextStep = readStream.pipe(gunzip);
    nextStep.pipe(extract);

    await extractionPromise;
  } else {
    const zip = new AdmZip(fromPath);

    for (const entry of zip.getEntries()) {
      const canonicalPath = path.normalize(toPath + path.sep + entry.entryName);

      // Prevent Zip Slip vulnerability by ensuring the path is within the target directory
      if (!canonicalPath.startsWith(toPath)) {
        throw new Error(`Entry "${entry.entryName}" would extract outside target directory`);
      }
    }

    zip.extractAllTo(toPath, true, true);
  }
}

async function generateChecksum(filepath: string) {
  const { fs } = getDeps();
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
  const { fs } = getDeps();
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

function getParentCacheDirectory(properties: ScannerProperties) {
  return path.join(properties[ScannerProperty.SonarUserHome], SONAR_CACHE_DIR);
}
