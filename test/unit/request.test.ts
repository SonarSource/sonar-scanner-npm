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
import axios from 'axios';
import { HttpProxyAgent, HttpsProxyAgent } from 'hpagent';
import { fetch, getHttpAgents, initializeAxios } from '../../src/request';
import { ScannerProperties, ScannerProperty } from '../../src/types';

jest.mock('axios', () => ({
  create: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('request', () => {
  describe('http-agent', () => {
    it('should define proxy url correctly', () => {
      const agents = getHttpAgents({
        [ScannerProperty.SonarHostUrl]: 'https://sonarcloud.io',
        [ScannerProperty.SonarScannerProxyHost]: 'proxy.com',
      });
      expect(agents.httpAgent).toBeInstanceOf(HttpProxyAgent);
      expect(agents.httpAgent?.proxy.toString()).toBe('https://proxy.com/');
      expect(agents.httpsAgent).toBeInstanceOf(HttpsProxyAgent);
      expect(agents.httpsAgent?.proxy.toString()).toBe('https://proxy.com/');
    });

    it('should not define agents when no proxy is provided', () => {
      const agents = getHttpAgents({
        [ScannerProperty.SonarHostUrl]: 'https://sonarcloud.io',
      });
      expect(agents.httpAgent).toBeUndefined();
      expect(agents.httpsAgent).toBeUndefined();
      expect(agents).toEqual({});
    });
  });

  describe('fetch', () => {
    it('should initialize axios', () => {
      jest.spyOn(axios, 'create');

      const properties: ScannerProperties = {
        [ScannerProperty.SonarHostUrl]: 'https://sonarcloud.io',
        [ScannerProperty.SonarToken]: 'testToken',
      };

      initializeAxios(properties);

      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://sonarcloud.io',
        headers: {
          Authorization: `Bearer testToken`,
        },
      });
    });

    it('should throw error if axios is not initialized', () => {
      expect(() => fetch({})).toThrow('Axios instance is not initialized');
    });

    it('should call axios request if axios is initialized', () => {
      const mockedRequest = jest.fn();
      jest.spyOn(axios, 'create').mockImplementation(
        () =>
          ({
            request: mockedRequest,
          }) as any,
      );

      const properties: ScannerProperties = {
        [ScannerProperty.SonarHostUrl]: 'https://sonarcloud.io',
        [ScannerProperty.SonarToken]: 'testToken',
      };

      initializeAxios(properties);

      const config = { url: 'https://sonarcloud.io/api/issues/search' };

      fetch(config);
      expect(mockedRequest).toHaveBeenCalledWith(config);
    });
  });
});
