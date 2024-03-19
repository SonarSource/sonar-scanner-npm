import AdmZip from 'adm-zip';
import axios, { AxiosRequestConfig } from 'axios';
import fs from 'fs';
import * as stream from 'stream';
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

export function extractArchive(archivePath: string, destPath: string) {
  // TODO: Add support for .tar.gz (only ,zip supported for now)
  log(LogLevel.INFO, `Extracting ${archivePath} to ${destPath}`);
  const zip = new AdmZip(archivePath);
  zip.extractAllTo(destPath, true);
}

export function allowExecution(filePath: string) {
  log(LogLevel.INFO, `Allowing execution of ${filePath}`);
  fs.chmodSync(filePath, 0o755);
}

export async function cleanupDownloadCache() {
  log(LogLevel.INFO, 'Cleaning up cache');
  // TODO: Implement
}
