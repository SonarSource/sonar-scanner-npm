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
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { HttpProxyAgent, HttpsProxyAgent } from 'hpagent';
import { promisify } from 'util';
import * as stream from 'stream';
import fs from 'fs';
import { getProxyUrl } from './proxy';
import { ScannerProperties, ScannerProperty } from './types';
import { log, LogLevel } from './logging';

const finished = promisify(stream.finished);

// The axios instance is private to this module
let _axiosInstance: AxiosInstance | null = null;

export function getHttpAgents(
  properties: ScannerProperties,
): Pick<AxiosRequestConfig, 'httpAgent' | 'httpsAgent'> {
  const agents: Pick<AxiosRequestConfig, 'httpAgent' | 'httpsAgent'> = {};
  const proxyUrl = getProxyUrl(properties);

  if (proxyUrl) {
    agents.httpsAgent = new HttpsProxyAgent({ proxy: proxyUrl.toString() });
    agents.httpAgent = new HttpProxyAgent({ proxy: proxyUrl.toString() });
  }
  return agents;
}

export function initializeAxios(properties: ScannerProperties) {
  const token = properties[ScannerProperty.SonarToken];
  const baseURL = properties[ScannerProperty.SonarHostUrl];
  const agents = getHttpAgents(properties);

  if (!_axiosInstance) {
    _axiosInstance = axios.create({
      baseURL,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      ...agents,
    });
  }
}

export function fetch(config: AxiosRequestConfig) {
  if (!_axiosInstance) {
    throw new Error('Axios instance is not initialized');
  }

  return _axiosInstance.request(config);
}

export async function download(properties: ScannerProperties, url: string, destPath: string) {
  log(LogLevel.DEBUG, `Downloading ${url} to ${destPath}`);

  const response = await fetch({
    url,
    method: 'GET',
    responseType: 'stream',
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
    log(LogLevel.INFO, `\nJRE Download complete`);
  });

  const writer = fs.createWriteStream(destPath);
  const streamPipeline = promisify(stream.pipeline);
  await streamPipeline(response.data, writer);
  response.data.pipe(writer);
  await finished(writer);
}
