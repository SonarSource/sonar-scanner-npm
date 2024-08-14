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
import axios, { AxiosInstance } from 'axios';
import fsExtra from 'fs-extra';
import { HttpProxyAgent, HttpsProxyAgent } from 'hpagent';
import path from 'path';
import { SONARCLOUD_API_BASE_URL, SONARCLOUD_URL } from '../../src/constants';
import * as logging from '../../src/logging';
import { fetch, getHttpAgents, initializeAxios, resetAxios } from '../../src/request';
import { ScannerProperty } from '../../src/types';

jest.mock('axios', () => ({
  create: jest.fn().mockReturnValue({ request: jest.fn() }),
  request: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  resetAxios();
});

describe('request', () => {
  describe('http-agent', () => {
    describe('with proxy options', () => {
      it('should define proxy url correctly', async () => {
        const agents = await getHttpAgents({
          [ScannerProperty.SonarHostUrl]: SONARCLOUD_URL,
          [ScannerProperty.SonarScannerProxyHost]: 'proxy.com',
        });
        expect(agents.httpAgent).toBeInstanceOf(HttpProxyAgent);
        expect(agents.httpAgent?.proxy.toString()).toBe('https://proxy.com/');
        expect(agents.httpsAgent).toBeInstanceOf(HttpsProxyAgent);
        expect(agents.httpsAgent?.proxy.toString()).toBe('https://proxy.com/');
      });

      it('should not define agents when no proxy is provided', async () => {
        const agents = await getHttpAgents({
          [ScannerProperty.SonarHostUrl]: SONARCLOUD_URL,
        });
        expect(agents.httpAgent).toBeUndefined();
        expect(agents.httpsAgent).toBeUndefined();
        expect(agents).toEqual({});
      });
    });

    describe('with tls options', () => {
      it('should initialize axios with password-protected truststore', async () => {
        jest.spyOn(axios, 'create');

        const truststorePath = path.join(__dirname, 'fixtures', 'ssl', 'truststore.p12');
        const truststorePass = 'password';
        const certificatePath = path.join(__dirname, 'fixtures', 'ssl', 'ca.pem');
        const certificatePem = fsExtra
          .readFileSync(certificatePath)
          .toString()
          .replace(/\n/g, '\r\n');

        const { httpsAgent } = await getHttpAgents({
          [ScannerProperty.SonarHostUrl]: SONARCLOUD_URL,
          [ScannerProperty.SonarScannerTruststorePath]: truststorePath,
          [ScannerProperty.SonarScannerTruststorePassword]: truststorePass,
        });

        const ca = httpsAgent?.options.ca as string[];
        expect(ca).toHaveLength(1);
        expect(ca).toContain(certificatePem);
      });

      it("should not fail if truststore can't be parsed", async () => {
        jest.spyOn(axios, 'create');
        jest.spyOn(logging, 'log');

        const truststorePath = path.join(__dirname, 'fixtures', 'ssl', 'truststore-invalid.p12');
        const truststorePass = 'password';

        const { httpsAgent } = await getHttpAgents({
          [ScannerProperty.SonarHostUrl]: SONARCLOUD_URL,
          [ScannerProperty.SonarScannerTruststorePath]: truststorePath,
          [ScannerProperty.SonarScannerTruststorePassword]: truststorePass,
        });

        expect(httpsAgent).toBeUndefined();
        expect(logging.log).toHaveBeenCalledWith(
          logging.LogLevel.WARN,
          expect.stringContaining('Failed to load truststore'),
        );
      });

      it('should initialize axios with password-protected empty truststore', async () => {
        jest.spyOn(axios, 'create');
        const truststorePath = path.join(__dirname, 'fixtures', 'ssl', 'truststore-empty.p12');
        const truststorePass = 'password';

        const { httpsAgent } = await getHttpAgents({
          [ScannerProperty.SonarHostUrl]: SONARCLOUD_URL,
          [ScannerProperty.SonarScannerTruststorePath]: truststorePath,
          [ScannerProperty.SonarScannerTruststorePassword]: truststorePass,
        });

        const ca = httpsAgent?.options.ca as string[];
        expect(ca).toHaveLength(0);
      });

      it('should initialize axios with password-protected keystore', async () => {
        jest.spyOn(axios, 'create');
        const keystorePath = path.join(__dirname, 'fixtures', 'ssl', 'keystore.p12');
        const keystorePass = 'password';

        const { httpsAgent } = await getHttpAgents({
          [ScannerProperty.SonarHostUrl]: SONARCLOUD_URL,
          [ScannerProperty.SonarScannerKeystorePath]: keystorePath,
          [ScannerProperty.SonarScannerKeystorePassword]: keystorePass,
        });

        expect(httpsAgent?.options.pfx).toEqual(fsExtra.readFileSync(keystorePath));
        expect(httpsAgent?.options.passphrase).toBe(keystorePass);
      });
    });

    it('should support combining proxy, truststore and keystore', async () => {
      jest.spyOn(axios, 'create');
      const truststorePath = path.join(__dirname, 'fixtures', 'ssl', 'truststore.p12');
      const truststorePass = 'password';
      const certificatePath = path.join(__dirname, 'fixtures', 'ssl', 'ca.pem');
      const certificatePem = fsExtra
        .readFileSync(certificatePath)
        .toString()
        .replace(/\n/g, '\r\n');
      const keystorePath = path.join(__dirname, 'fixtures', 'ssl', 'keystore.p12');
      const keystorePass = 'password';

      const { httpsAgent } = await getHttpAgents({
        [ScannerProperty.SonarHostUrl]: SONARCLOUD_URL,
        [ScannerProperty.SonarScannerProxyHost]: 'proxy.com',
        [ScannerProperty.SonarScannerTruststorePath]: truststorePath,
        [ScannerProperty.SonarScannerTruststorePassword]: truststorePass,
        [ScannerProperty.SonarScannerKeystorePath]: keystorePath,
        [ScannerProperty.SonarScannerKeystorePassword]: keystorePass,
      });

      const ca = httpsAgent?.options.ca as string[];
      expect(ca).toHaveLength(1);
      expect(ca).toContain(certificatePem);
      expect(httpsAgent?.options.pfx).toEqual(fsExtra.readFileSync(keystorePath));
      expect(httpsAgent?.options.passphrase).toBe(keystorePass);
      expect(httpsAgent?.proxy.toString()).toBe('https://proxy.com/');
    });
  });

  describe('initializeAxios', () => {
    it('should initialize axios', async () => {
      jest.spyOn(axios, 'create');

      await initializeAxios({
        [ScannerProperty.SonarHostUrl]: SONARCLOUD_URL,
        [ScannerProperty.SonarScannerApiBaseUrl]: SONARCLOUD_API_BASE_URL,
        [ScannerProperty.SonarToken]: 'testToken',
      });

      expect(axios.create).toHaveBeenCalledTimes(2);
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: SONARCLOUD_API_BASE_URL,
        headers: {
          Authorization: `Bearer testToken`,
        },
        timeout: 0,
      });
      expect(axios.create).toHaveBeenCalledWith({
        timeout: 0,
      });
    });

    it('should initialize axios with timeout', async () => {
      jest.spyOn(axios, 'create');

      await initializeAxios({
        [ScannerProperty.SonarHostUrl]: SONARCLOUD_URL,
        [ScannerProperty.SonarScannerApiBaseUrl]: SONARCLOUD_API_BASE_URL,
        [ScannerProperty.SonarToken]: 'testToken',
        [ScannerProperty.SonarScannerResponseTimeout]: '23',
      });

      expect(axios.create).toHaveBeenCalledWith({
        baseURL: SONARCLOUD_API_BASE_URL,
        headers: {
          Authorization: `Bearer testToken`,
        },
        timeout: 23000,
      });
      expect(axios.create).toHaveBeenCalledWith({
        timeout: 23000,
      });
    });

    it('should initialize axios without token', async () => {
      jest.spyOn(axios, 'create');

      await initializeAxios({
        [ScannerProperty.SonarHostUrl]: SONARCLOUD_URL,
        [ScannerProperty.SonarScannerApiBaseUrl]: SONARCLOUD_API_BASE_URL,
      });

      expect(axios.create).toHaveBeenCalledWith({
        baseURL: SONARCLOUD_API_BASE_URL,
        headers: {},
        timeout: 0,
      });
      expect(axios.create).toHaveBeenCalledWith({
        timeout: 0,
      });
    });
  });

  describe('fetch', () => {
    it('should throw error if axios is not initialized', () => {
      jest.spyOn(axios, 'request');

      expect(() => fetch({ url: '/some-url' })).toThrow('Axios instance is not initialized');
    });

    it('should use correct axios instance based on URL', async () => {
      const mockedRequestInternal = jest.fn();
      const mockedRequestExternal = jest.fn();
      jest.spyOn(axios, 'create').mockImplementation(
        options =>
          ({
            request: options?.baseURL ? mockedRequestInternal : mockedRequestExternal,
          }) as any as AxiosInstance,
      );

      await initializeAxios({
        [ScannerProperty.SonarHostUrl]: SONARCLOUD_URL,
        [ScannerProperty.SonarToken]: 'testToken',
        [ScannerProperty.SonarScannerApiBaseUrl]: SONARCLOUD_API_BASE_URL,
      });

      await fetch({ url: 'https://sonarcloud.io/api/issues/search' });
      await fetch({ url: 'http://sonarcloud.io/api/issues/search' });
      expect(mockedRequestInternal).not.toHaveBeenCalled();
      expect(mockedRequestExternal).toHaveBeenCalledTimes(2);

      await fetch({ url: '/api/issues/search' });
      await fetch({ url: '/issues/search' });
      expect(mockedRequestInternal).toHaveBeenCalledTimes(2);
      expect(mockedRequestExternal).toHaveBeenCalledTimes(2);
    });

    it('should call axios request if axios is initialized', async () => {
      const mockedRequest = jest.fn();
      jest.spyOn(axios, 'create').mockImplementation(
        () =>
          ({
            request: mockedRequest,
          }) as any,
      );

      await initializeAxios({
        [ScannerProperty.SonarHostUrl]: SONARCLOUD_URL,
        [ScannerProperty.SonarToken]: 'testToken',
      });

      const config = { url: '/api/issues/search' };

      fetch(config);
      expect(mockedRequest).toHaveBeenCalledWith(config);
    });
  });
});
