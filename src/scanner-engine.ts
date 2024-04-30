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
import { spawn } from 'child_process';
import fs from 'fs';
import {
  extractArchive,
  getCacheDirectories,
  getCacheFileLocation,
  validateChecksum,
} from './file';
import { LogLevel, log, logWithPrefix } from './logging';
import { proxyUrlToJavaOptions } from './proxy';
import { download, fetch } from './request';
import {
  CacheFileData,
  ScanOptions,
  ScannerLogEntry,
  ScannerProperties,
  ScannerProperty,
} from './types';

export async function fetchScannerEngine(properties: ScannerProperties) {
  log(LogLevel.DEBUG, 'Detecting latest version of Scanner Engine');
  const { data } = await fetch({
    // TODO: replace with /api/v2/analysis/engine
    url: '/batch/index',
  });
  const [filename, md5] = data.trim().split('|');
  log(LogLevel.INFO, 'Latest Supported Scanner Engine: ', filename);

  log(LogLevel.DEBUG, 'Looking for Cached Scanner Engine');

  // TODO: use sha256 instead of md5
  const cacheFileData: CacheFileData = { md5, filename };
  const cachedScannerEngine = await getCacheFileLocation(properties, cacheFileData);

  if (cachedScannerEngine) {
    log(LogLevel.INFO, 'Using Cached Scanner Engine');
    properties[ScannerProperty.SonarScannerWasEngineCacheHit] = 'true';

    return cachedScannerEngine;
  }

  properties[ScannerProperty.SonarScannerWasEngineCacheHit] = 'false';

  const { archivePath, unarchivePath: scannerEnginePath } = await getCacheDirectories(properties, {
    md5,
    filename,
  });

  // TODO: replace with /api/v2/analysis/engine/<filename>
  log(LogLevel.DEBUG, `Starting download of Scanner Engine`);
  await download(`/batch/file?name=${filename}`, archivePath);
  log(LogLevel.INFO, `Downloaded Scanner Engine to ${scannerEnginePath}`);

  await validateChecksum(archivePath, md5);

  log(LogLevel.INFO, `Extracting Scanner Engine to ${scannerEnginePath}`);
  await extractArchive(archivePath, scannerEnginePath);
  return scannerEnginePath;
}

async function logOutput(message: string) {
  try {
    // Try and assume the log comes from the scanner engine
    const parsed = JSON.parse(message) as ScannerLogEntry;
    logWithPrefix(parsed.level, 'ScannerEngine', parsed.formattedMessage);
    if (parsed.throwable) {
      // Console.log without newline
      process.stdout.write(parsed.throwable);
    }
  } catch (e) {
    process.stdout.write(message);
  }
}

export function runScannerEngine(
  javaBinPath: string,
  scannerEnginePath: string,
  scanOptions: ScanOptions,
  properties: ScannerProperties,
) {
  log(LogLevel.INFO, 'Running the Scanner Engine');

  // The scanner engine expects a JSON object of properties attached to a key name "scannerProperties"
  const propertiesJSON = JSON.stringify({ scannerProperties: properties });

  // Run the scanner-engine
  const args = [
    ...proxyUrlToJavaOptions(properties),
    ...(scanOptions.jvmOptions ?? []),
    '-jar',
    scannerEnginePath,
  ];

  // If debugging with dumpToFile, write the properties to a file and exit
  const dumpToFile = properties[ScannerProperty.SonarScannerInternalDumpToFile];
  if (dumpToFile) {
    const data = {
      propertiesJSON,
      javaBinPath,
      scannerEnginePath,
      args,
    };
    log(LogLevel.INFO, 'Dumping data to file and exiting');
    return fs.promises.writeFile(dumpToFile, JSON.stringify(data, null, 2));
  }

  log(LogLevel.DEBUG, 'Running scanner engine', javaBinPath, ...args);
  const child = spawn(javaBinPath, args);

  log(LogLevel.DEBUG, 'Writing properties to scanner engine', propertiesJSON);
  child.stdin.write(propertiesJSON);
  child.stdin.end();

  child.stdout.on('data', buffer => buffer.toString().trim().split('\n').forEach(logOutput));
  child.stderr.on('data', buffer => log(LogLevel.ERROR, buffer.toString()));

  return new Promise<void>((resolve, reject) => {
    child.on('exit', code => {
      if (code === 0) {
        log(LogLevel.INFO, 'Scanner engine finished successfully');
        resolve();
      } else {
        reject(new Error(`Scanner engine failed with code ${code}`));
      }
    });
  });
}
