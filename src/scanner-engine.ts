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
import { spawn } from 'node:child_process';
import { API_V2_SCANNER_ENGINE_ENDPOINT, SONAR_SCANNER_ALIAS } from './constants';
import { defaultFsDeps, defaultSpawn, FsDeps, SpawnFn } from './deps';
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
  AnalysisEngineResponseType,
  ScanOptions,
  ScannerLogEntry,
  ScannerProperties,
  ScannerProperty,
} from './types';

export interface ScannerEngineDeps {
  fsDeps?: FsDeps;
  spawnFn?: SpawnFn;
  fetchFn?: typeof fetch;
  downloadFn?: typeof download;
  getCacheFileLocationFn?: typeof getCacheFileLocation;
  getCacheDirectoriesFn?: typeof getCacheDirectories;
  validateChecksumFn?: typeof validateChecksum;
  extractArchiveFn?: typeof extractArchive;
}

export async function fetchScannerEngine(
  properties: ScannerProperties,
  deps: ScannerEngineDeps = {},
) {
  const {
    fsDeps = defaultFsDeps,
    fetchFn = fetch,
    downloadFn = download,
    getCacheFileLocationFn = getCacheFileLocation,
    getCacheDirectoriesFn = getCacheDirectories,
    validateChecksumFn = validateChecksum,
  } = deps;

  log(LogLevel.DEBUG, `Detecting latest version of ${SONAR_SCANNER_ALIAS}`);
  const { data } = await fetchFn<AnalysisEngineResponseType>({
    url: API_V2_SCANNER_ENGINE_ENDPOINT,
  });
  const { sha256: checksum, filename, downloadUrl } = data;
  log(LogLevel.DEBUG, `Latest ${SONAR_SCANNER_ALIAS} version:`, filename);

  log(LogLevel.DEBUG, `Looking for Cached ${SONAR_SCANNER_ALIAS}`);
  const cachedScannerEngine = await getCacheFileLocationFn(properties, {
    checksum,
    filename,
    alias: SONAR_SCANNER_ALIAS,
  });
  if (cachedScannerEngine) {
    log(LogLevel.DEBUG, `Using ${SONAR_SCANNER_ALIAS} from the cache`);
    properties[ScannerProperty.SonarScannerWasEngineCacheHit] = 'true';

    return cachedScannerEngine;
  }

  properties[ScannerProperty.SonarScannerWasEngineCacheHit] = 'false';

  const { archivePath } = await getCacheDirectoriesFn(properties, {
    checksum,
    filename,
    alias: SONAR_SCANNER_ALIAS,
  });
  const url = downloadUrl ?? API_V2_SCANNER_ENGINE_ENDPOINT;
  log(LogLevel.DEBUG, `Starting download of ${SONAR_SCANNER_ALIAS}`);
  await downloadFn(url, archivePath);
  log(LogLevel.INFO, `Downloaded ${SONAR_SCANNER_ALIAS} to ${archivePath}`);

  try {
    await validateChecksumFn(archivePath, checksum);
  } catch (error) {
    await fsDeps.remove(archivePath);
    throw error;
  }

  return archivePath;
}

async function logOutput(message: string) {
  try {
    // Try and assume the log comes from the scanner engine
    const parsed = JSON.parse(message) as ScannerLogEntry;
    logWithPrefix(parsed.level, 'ScannerEngine', parsed.message);
    if (parsed.stacktrace) {
      // Console.log without newline
      process.stdout.write(parsed.stacktrace);
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
  deps: ScannerEngineDeps = {},
) {
  const { fsDeps = defaultFsDeps, spawnFn = defaultSpawn } = deps;

  log(LogLevel.DEBUG, `Running the ${SONAR_SCANNER_ALIAS}`);

  // The scanner engine expects a JSON object of properties attached to a key name "scannerProperties"
  const propertiesJSON = JSON.stringify({
    scannerProperties: Object.entries(properties).map(([key, value]) => ({
      key,
      value,
    })),
  });

  // Run the scanner-engine
  const args = [
    ...proxyUrlToJavaOptions(properties),
    ...(scanOptions.jvmOptions ?? []),
    ...(properties[ScannerProperty.SonarScannerJavaOptions]
      ? properties[ScannerProperty.SonarScannerJavaOptions].split(' ')
      : []),
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
    return fsDeps.promises.writeFile(dumpToFile, JSON.stringify(data, null, 2));
  }

  log(LogLevel.DEBUG, `Running ${SONAR_SCANNER_ALIAS}`, javaBinPath, ...args);
  const child = spawnFn(javaBinPath, args);

  log(LogLevel.DEBUG, `Writing properties to ${SONAR_SCANNER_ALIAS}`, propertiesJSON);
  child.stdin.write(propertiesJSON);
  child.stdin.end();

  child.stdout.on('data', buffer => buffer.toString().trim().split('\n').forEach(logOutput));
  child.stderr.on('data', buffer => log(LogLevel.ERROR, buffer.toString()));

  return new Promise<void>((resolve, reject) => {
    child.on('exit', code => {
      if (code === 0) {
        log(LogLevel.DEBUG, 'Scanner engine finished successfully');
        resolve();
      } else {
        reject(new Error(`Scanner engine failed with code ${code}`));
      }
    });
  });
}
