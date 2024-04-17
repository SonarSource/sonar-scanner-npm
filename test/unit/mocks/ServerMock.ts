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
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { fetch } from '../../../src/request';

jest.mock('../../../src/request');

const DEFAULT_AXIOS_RESPONSE: AxiosResponse = {
  data: '',
  status: 200,
  statusText: 'OK',
  config: {},
  headers: {},
} as AxiosResponse;

export class ServerMock {
  responses: (Partial<AxiosResponse> | Error)[] = [];

  constructor() {
    jest.mocked(fetch).mockImplementation(this.handleFetch.bind(this));
  }

  mockServerVersionResponse(version: string) {
    this.responses.push({
      data: version,
      status: 200,
      statusText: 'OK',
    });
  }

  mockServerErrorResponse() {
    this.responses.push(new Error('Not found'));
  }

  async handleFetch(_token: string, _config: AxiosRequestConfig) {
    if (this.responses.length === 0) {
      return { ...DEFAULT_AXIOS_RESPONSE };
    }

    const response = this.responses.shift();
    if (response instanceof Error) {
      throw response;
    } else {
      return { ...DEFAULT_AXIOS_RESPONSE, ...response };
    }
  }

  reset() {
    this.responses = [];
  }
}
