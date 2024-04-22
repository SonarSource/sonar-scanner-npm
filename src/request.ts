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
import { getProxyUrl } from './proxy';
import { ScannerProperties, ScannerProperty } from './types';

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
