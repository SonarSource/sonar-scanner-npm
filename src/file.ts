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
import * as fsExtra from 'fs-extra';
import AdmZip from 'adm-zip';
import zlib from 'zlib';
import tarStream from 'tar-stream';
import fs from 'fs';
import path from 'path';
import { SONAR_CACHE_DIR } from './constants';
import { log, LogLevel } from './logging';
import { ScannerProperties, ScannerProperty } from './types';
import { getHttpAgents } from './http-agent';
import { getProxyUrl } from './proxy';
import { fetch } from './request';
import { promisify } from 'util';
import * as stream from 'stream';

const finished = promisify(stream.finished);

export async function download(
  properties: ScannerProperties,
  url: string,
  fileData: { filename: string; md5: string },
) {
  const archivePath = path.join(SONAR_CACHE_DIR, fileData.md5, fileData.filename);

  try {
    const token = properties[ScannerProperty.SonarToken];
    const proxyUrl = getProxyUrl(properties);

    log(LogLevel.INFO, `Downloading from ${url} to ${archivePath}`);
    const writer = fs.createWriteStream(archivePath);

    const response = await fetch(token, {
      url,
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
      process.stdout.write('\n');
      log(LogLevel.INFO, 'Download complete');
    });

    const streamPipeline = promisify(stream.pipeline);
    await streamPipeline(response.data, writer);

    response.data.pipe(writer);

    await finished(writer);
  } catch (error: unknown) {
    log(LogLevel.ERROR, 'Error during download', error);
    throw error;
  }

  await validateChecksum(archivePath, fileData.md5);
}

export async function getCachedFileLocation(md5: string, filename: string) {
  const filePath = path.join(SONAR_CACHE_DIR, md5, filename);
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
    zip.extractAllTo(toPath, true);
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
