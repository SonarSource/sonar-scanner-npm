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
import fs from 'fs';
import { HttpProxyAgent, HttpsProxyAgent } from 'hpagent';
import https from 'https';
import forge from 'node-forge';
import * as stream from 'stream';
import { promisify } from 'util';
import { LogLevel, log } from './logging';
import { getProxyUrl } from './proxy';
import { ScannerProperties, ScannerProperty } from './types';

const finished = promisify(stream.finished);

/**
 * Axios instances (private to this module).
 * One for sonar host (with auth), one for external requests
 */
let _axiosInstances: {
  internal: AxiosInstance;
  external: AxiosInstance;
} | null = null;

async function extractTruststoreCerts(p12Base64: string, password: string = ''): Promise<string[]> {
  // P12/PFX file -> DER -> ASN.1 -> PKCS12
  const der = forge.util.decode64(p12Base64);
  const asn1 = forge.asn1.fromDer(der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);

  // Extract the CA certificates as PEM for Node
  const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const ca: string[] = [];
  for (const entry of bags[forge.pki.oids.certBag] ?? []) {
    if (entry.cert) {
      ca.push(forge.pki.certificateToPem(entry.cert));
    }
  }

  log(LogLevel.DEBUG, `${ca.length} CA certificates found in truststore`);
  return ca;
}

export async function getHttpAgents(
  properties: ScannerProperties,
): Promise<Pick<AxiosRequestConfig, 'httpAgent' | 'httpsAgent'>> {
  const agents: Pick<AxiosRequestConfig, 'httpAgent' | 'httpsAgent'> = {};
  const proxyUrl = getProxyUrl(properties);

  // Accumulate https agent options
  const httpsAgentOptions: https.AgentOptions = {};

  // Truststore
  const truststorePath = properties[ScannerProperty.SonarScannerTruststorePath];
  if (truststorePath) {
    log(LogLevel.DEBUG, `Using truststore at ${truststorePath}`);
    const p12Base64 = await fs.promises.readFile(truststorePath, { encoding: 'base64' });
    try {
      const certs = await extractTruststoreCerts(
        p12Base64,
        properties[ScannerProperty.SonarScannerTruststorePassword],
      );
      httpsAgentOptions.ca = certs;
    } catch (e) {
      log(LogLevel.WARN, `Failed to load truststore: ${e}`);
    }
  }

  // Key store
  const keystorePath = properties[ScannerProperty.SonarScannerKeystorePath];
  if (keystorePath) {
    log(LogLevel.DEBUG, `Using keystore at ${keystorePath}`);
    httpsAgentOptions.pfx = await fs.promises.readFile(keystorePath);
    httpsAgentOptions.passphrase = properties[ScannerProperty.SonarScannerKeystorePassword] ?? '';
  }

  if (proxyUrl) {
    agents.httpsAgent = new HttpsProxyAgent({ proxy: proxyUrl.toString(), ...httpsAgentOptions });
    agents.httpAgent = new HttpProxyAgent({ proxy: proxyUrl.toString() });
  } else if (Object.keys(httpsAgentOptions).length > 0) {
    // Only create an agent if there are options
    agents.httpsAgent = new https.Agent({ ...httpsAgentOptions });
  }
  return agents;
}

export function resetAxios() {
  _axiosInstances = null;
}

export async function initializeAxios(properties: ScannerProperties) {
  const token = properties[ScannerProperty.SonarToken];
  const baseURL = properties[ScannerProperty.SonarScannerApiBaseUrl];
  const agents = await getHttpAgents(properties);
  const timeout =
    Math.floor(parseInt(properties[ScannerProperty.SonarScannerResponseTimeout], 10) || 0) * 1000;

  if (!_axiosInstances) {
    _axiosInstances = {
      internal: axios.create({
        baseURL,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout,
        ...agents,
      }),
      external: axios.create({
        timeout,
        ...agents,
      }),
    };
  }
}

export function fetch<T = unknown>(config: AxiosRequestConfig) {
  if (!_axiosInstances) {
    throw new Error('Axios instance is not initialized');
  }
  // Use external instance for absolute URLs
  if (!config.url?.startsWith('/')) {
    log(LogLevel.DEBUG, `Not using axios instance for ${config.url}`);
    return _axiosInstances.external.request<T>(config);
  }
  return _axiosInstances.internal.request<T>(config);
}

export async function download(url: string, destPath: string, overrides?: AxiosRequestConfig) {
  log(LogLevel.DEBUG, `Downloading ${url} to ${destPath}`);

  const response = await fetch<NodeJS.ReadStream>({
    url,
    method: 'GET',
    responseType: 'stream',
    headers: {
      Accept: 'application/octet-stream',
    },
    ...overrides,
  });

  const totalLength = response.headers['content-length'];

  if (totalLength) {
    let progress = 0;

    response.data.on('data', (chunk: any) => {
      progress += chunk.length;
      process.stdout.write(
        `\r[INFO] Bootstrapper:: Downloaded ${Math.round((progress / totalLength) * 100)}%`,
      );
    });
  } else {
    log(LogLevel.INFO, 'Download started');
  }

  response.data.on('end', () => {
    totalLength && process.stdout.write('\n');
    log(LogLevel.INFO, 'Download complete');
  });

  const writer = fs.createWriteStream(destPath);
  const streamPipeline = promisify(stream.pipeline);
  await streamPipeline(response.data, writer);
  response.data.pipe(writer);
  await finished(writer);
}
