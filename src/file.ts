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

import * as fsExtra from 'fs-extra';
import AdmZip from 'adm-zip';
import zlib from 'zlib';
import tarStream from 'tar-stream';
import fs from 'fs';
import path from 'path';
import { SONAR_CACHE_DIR } from './constants';
import { log, LogLevel } from './logging';

export async function getCachedFileLocation(md5: string, filename: string) {
  const filePath = path.join(SONAR_CACHE_DIR, md5, filename);
  if (fs.existsSync(filePath)) {
    log(LogLevel.INFO, 'Found Cached JRE: ', filePath);
    return filePath;
  } else {
    log(LogLevel.INFO, 'No Cached JRE found');
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
