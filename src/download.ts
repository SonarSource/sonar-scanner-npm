import AdmZip from 'adm-zip';
import axios, { AxiosRequestConfig } from 'axios';
import fs from 'fs';
import * as stream from 'stream';
import { join, dirname } from 'path';
import zlib from 'zlib';
import tarStream from 'tar-stream';
import * as fsExtra from 'fs-extra';
import { promisify } from 'util';
import { LogLevel, log } from './logging';

const finished = promisify(stream.finished);

export async function downloadFile(url: string, destPath: string, options?: AxiosRequestConfig) {
  // Create destination directory if it doesn't exist
  const dir = destPath.substring(0, destPath.lastIndexOf('/'));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  log(LogLevel.INFO, `Downloaded ${url} to ${destPath}`);
  const writer = fs.createWriteStream(destPath);
  const response = await axios({
    url,
    responseType: 'stream',
    method: 'get',
    ...options,
  });
  response.data.pipe(writer);

  // TODO: Verify checksum. Do it here or in caller(?) to be decided

  await finished(writer);
}

export async function extractArchive(archivePath: string, destPath: string) {
  if (archivePath.endsWith('.tar.gz')) {
    const tarFilePath = archivePath;
    const targetDirectory = destPath;
    const extract = tarStream.extract();

    const extractionPromise = new Promise((resolve, reject) => {
      extract.on('entry', async (header, stream, next) => {
        const filePath = join(targetDirectory, header.name);
        // Ensure the directory exists
        await fsExtra.ensureDir(dirname(filePath));

        stream.pipe(fs.createWriteStream(filePath));

        stream.on('end', function () {
          next(); // ready for next entry
        });

        stream.resume(); // just auto drain the stream
      });

      extract.on('finish', () => {
        log(LogLevel.INFO, 'tar.gz Extraction complete');
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
    log(LogLevel.INFO, `Extracting ${archivePath} to ${destPath}`);
    const zip = new AdmZip(archivePath);
    zip.extractAllTo(destPath, true);
  }
}

export function allowExecution(filePath: string) {
  log(LogLevel.INFO, `Allowing execution of ${filePath}`);
  fs.chmodSync(filePath, 0o755);
}

export async function cleanupDownloadCache() {
  log(LogLevel.INFO, 'Cleaning up cache');
  // TODO: Implement
}
