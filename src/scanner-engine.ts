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
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { SONAR_CACHE_DIR } from './constants';
import { downloadFile } from './download';
import { LogLevel, log } from './logging';
import { ScanOptions } from './scan';
import { ScannerLogEntry } from './types';

export function writePropertyFile(properties: Record<string, string>) {
  const filePath = path.join(os.tmpdir(), `sonar-scanner-npm-${Date.now()}.properties`); // TODO: What about conflict / race conditions? Should be fixed
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      Object.entries(properties).map(([key, value]) => ({
        key,
        value,
      })),
    ),
  );
  return filePath;
}

export async function fetchScannerEngine(serverUrl: string): Promise<string> {
  const { data } = await axios.get(`${serverUrl}/batch/index`);
  const [filename, md5] = data.trim().split('|');
  log(LogLevel.DEBUG, `Scanner engine: ${filename} (md5: ${md5})`);

  // TODO: Cache

  const scannerEnginePath = path.join(SONAR_CACHE_DIR, md5, filename);
  await downloadFile(`${serverUrl}/batch/file?name=${filename}`, scannerEnginePath);
  return scannerEnginePath;
}

export async function logScannerOutput(logEntry: Buffer) {
  try {
    const parsed = JSON.parse(logEntry.toString()) as ScannerLogEntry;
    log(parsed.level, 'ScannerEngine', parsed.formattedMessage);
    if (parsed.throwable) {
      // Console.log without newline
      process.stdout.write(parsed.throwable);
    }
  } catch (e) {
    process.stdout.write(logEntry.toString());
  }
}

export function runScannerEngine(
  javaBinPath: string,
  scannerEnginePath: string,
  scanOptions: ScanOptions,
) {
  // Run the scanner engine
  const propertiesFile = writePropertyFile(scanOptions.options ?? {});
  const scannerOptions = [
    ...(scanOptions.jvmOptions ?? []),
    '-jar',
    scannerEnginePath,
    propertiesFile,
  ];
  log(LogLevel.DEBUG, 'Running scanner engine', javaBinPath, ...scannerOptions);
  const scannerProcess = spawn(javaBinPath, scannerOptions, {
    env: {
      ...process.env,
      // TODO: That means the token passed in JS overrides the env var. Do we want this?
      SONAR_TOKEN: scanOptions.token ?? process.env.SONAR_TOKEN,
    },
  });

  // TODO: Fetch info from package.json

  return new Promise<void>((resolve, reject) => {
    scannerProcess.stdout.on('data', logScannerOutput);
    scannerProcess.stderr.on('data', data => {
      log(LogLevel.ERROR, data.toString());
    });
    scannerProcess.on('exit', code => {
      if (code === 0) {
        log(LogLevel.INFO, 'Scanner engine finished successfully');
        resolve();
      } else {
        log(LogLevel.ERROR, `Scanner engine failed with code ${code}`);
        // TODO: We currently fail with the code but do we want to memorize the last throwable to also throw it there?
        // So the user doesn't have to scroll up to see the error
        reject(new Error(`Scanner engine failed with code ${code}`));
      }
    });
  });
}
