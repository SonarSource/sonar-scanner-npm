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
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import axios, { AxiosInstance } from 'axios';
import fsExtra from 'fs-extra';
import { HttpProxyAgent, HttpsProxyAgent } from 'hpagent';
import path from 'node:path';
import { SONARCLOUD_API_BASE_URL, SONARCLOUD_URL } from '../../src/constants';
import { LogLevel } from '../../src/logging';
import { fetch, getHttpAgents, initializeAxios, resetAxios } from '../../src/request';
import { ScannerProperty } from '../../src/types';

// Mock console.log to suppress output and capture log calls
const mockLog = mock.fn();
mock.method(console, 'log', mockLog);

const mockedRequest = mock.fn();
const axiosCreateMock = mock.method(axios, 'create', () => ({ request: mockedRequest }));

beforeEach(() => {
  axiosCreateMock.mock.resetCalls();
  mockedRequest.mock.resetCalls();
  mockLog.mock.resetCalls();
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
        assert.ok(agents.httpAgent instanceof HttpProxyAgent);
        assert.strictEqual(agents.httpAgent?.proxy.toString(), 'http://proxy.com/');
        assert.ok(agents.httpsAgent instanceof HttpsProxyAgent);
        assert.strictEqual(agents.httpsAgent?.proxy.toString(), 'http://proxy.com/');
        assert.strictEqual(agents.proxy, false);
      });

      it('should not define agents when no proxy is provided', async () => {
        const agents = await getHttpAgents({
          [ScannerProperty.SonarHostUrl]: SONARCLOUD_URL,
        });
        assert.strictEqual(agents.httpAgent, undefined);
        assert.strictEqual(agents.httpsAgent, undefined);
        assert.strictEqual(agents.proxy, undefined);
        assert.deepStrictEqual(agents, {});
      });
    });

    describe('with tls options', () => {
      it('should initialize axios with password-protected truststore', async () => {
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
        assert.strictEqual(ca.length, 1);
        assert.ok(ca.includes(certificatePem));
      });

      it("should not fail if truststore can't be parsed", async () => {
        const truststorePath = path.join(__dirname, 'fixtures', 'ssl', 'truststore-invalid.p12');
        const truststorePass = 'password';

        const { proxy, httpsAgent } = await getHttpAgents({
          [ScannerProperty.SonarHostUrl]: SONARCLOUD_URL,
          [ScannerProperty.SonarScannerTruststorePath]: truststorePath,
          [ScannerProperty.SonarScannerTruststorePassword]: truststorePass,
        });

        assert.strictEqual(proxy, undefined);
        assert.strictEqual(httpsAgent, undefined);
        // Check that warning was logged via console.log
        assert.ok(
          mockLog.mock.calls.some(call =>
            call.arguments.some(
              (arg: unknown) =>
                typeof arg === 'string' && arg.includes('Failed to load truststore'),
            ),
          ),
        );
      });

      it('should initialize axios with password-protected empty truststore', async () => {
        const truststorePath = path.join(__dirname, 'fixtures', 'ssl', 'truststore-empty.p12');
        const truststorePass = 'password';

        const { proxy, httpsAgent } = await getHttpAgents({
          [ScannerProperty.SonarHostUrl]: SONARCLOUD_URL,
          [ScannerProperty.SonarScannerTruststorePath]: truststorePath,
          [ScannerProperty.SonarScannerTruststorePassword]: truststorePass,
        });

        assert.strictEqual(proxy, undefined);
        const ca = httpsAgent?.options.ca as string[];
        assert.strictEqual(ca.length, 0);
      });

      it('should initialize axios with password-protected keystore', async () => {
        const keystorePath = path.join(__dirname, 'fixtures', 'ssl', 'keystore.p12');
        const keystorePass = 'password';

        const { proxy, httpsAgent } = await getHttpAgents({
          [ScannerProperty.SonarHostUrl]: SONARCLOUD_URL,
          [ScannerProperty.SonarScannerKeystorePath]: keystorePath,
          [ScannerProperty.SonarScannerKeystorePassword]: keystorePass,
        });

        assert.strictEqual(proxy, undefined);
        assert.deepStrictEqual(httpsAgent?.options.pfx, fsExtra.readFileSync(keystorePath));
        assert.strictEqual(httpsAgent?.options.passphrase, keystorePass);
      });
    });

    it('should support combining proxy, truststore and keystore', async () => {
      const truststorePath = path.join(__dirname, 'fixtures', 'ssl', 'truststore.p12');
      const truststorePass = 'password';
      const certificatePath = path.join(__dirname, 'fixtures', 'ssl', 'ca.pem');
      const certificatePem = fsExtra
        .readFileSync(certificatePath)
        .toString()
        .replace(/\n/g, '\r\n');
      const keystorePath = path.join(__dirname, 'fixtures', 'ssl', 'keystore.p12');
      const keystorePass = 'password';

      const { httpsAgent, proxy } = await getHttpAgents({
        [ScannerProperty.SonarHostUrl]: SONARCLOUD_URL,
        [ScannerProperty.SonarScannerProxyHost]: 'proxy.com',
        [ScannerProperty.SonarScannerTruststorePath]: truststorePath,
        [ScannerProperty.SonarScannerTruststorePassword]: truststorePass,
        [ScannerProperty.SonarScannerKeystorePath]: keystorePath,
        [ScannerProperty.SonarScannerKeystorePassword]: keystorePass,
      });

      assert.strictEqual(proxy, false);

      const ca = httpsAgent?.options.ca as string[];
      assert.strictEqual(ca.length, 1);
      assert.ok(ca.includes(certificatePem));
      assert.deepStrictEqual(httpsAgent?.options.pfx, fsExtra.readFileSync(keystorePath));
      assert.strictEqual(httpsAgent?.options.passphrase, keystorePass);
      assert.strictEqual(httpsAgent?.proxy.toString(), 'http://proxy.com/');
    });
  });

  describe('initializeAxios', () => {
    it('should initialize axios', async () => {
      await initializeAxios({
        [ScannerProperty.SonarHostUrl]: SONARCLOUD_URL,
        [ScannerProperty.SonarScannerApiBaseUrl]: SONARCLOUD_API_BASE_URL,
        [ScannerProperty.SonarToken]: 'testToken',
      });

      assert.strictEqual(axiosCreateMock.mock.callCount(), 2);
      const calls = axiosCreateMock.mock.calls;
      assert.ok(
        calls.some(
          call =>
            call.arguments[0]?.baseURL === SONARCLOUD_API_BASE_URL &&
            call.arguments[0]?.headers?.Authorization === 'Bearer testToken',
        ),
      );
    });

    it('should initialize axios with timeout', async () => {
      await initializeAxios({
        [ScannerProperty.SonarHostUrl]: SONARCLOUD_URL,
        [ScannerProperty.SonarScannerApiBaseUrl]: SONARCLOUD_API_BASE_URL,
        [ScannerProperty.SonarToken]: 'testToken',
        [ScannerProperty.SonarScannerResponseTimeout]: '23',
      });

      const calls = axiosCreateMock.mock.calls;
      assert.ok(calls.some(call => call.arguments[0]?.timeout === 23000));
    });

    it('should initialize axios without token', async () => {
      await initializeAxios({
        [ScannerProperty.SonarHostUrl]: SONARCLOUD_URL,
        [ScannerProperty.SonarScannerApiBaseUrl]: SONARCLOUD_API_BASE_URL,
      });

      const calls = axiosCreateMock.mock.calls;
      assert.ok(
        calls.some(
          call =>
            call.arguments[0]?.baseURL === SONARCLOUD_API_BASE_URL &&
            Object.keys(call.arguments[0]?.headers ?? {}).length === 0,
        ),
      );
    });
  });

  describe('fetch', () => {
    it('should throw error if axios is not initialized', () => {
      assert.throws(() => fetch({ url: '/some-url' }), {
        message: 'Axios instance is not initialized',
      });
    });

    it('should use correct axios instance based on URL', async () => {
      const mockedRequestInternal = mock.fn();
      const mockedRequestExternal = mock.fn();
      axiosCreateMock.mock.mockImplementation(
        (options: any) =>
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
      assert.strictEqual(mockedRequestInternal.mock.callCount(), 0);
      assert.strictEqual(mockedRequestExternal.mock.callCount(), 2);

      await fetch({ url: '/api/issues/search' });
      await fetch({ url: '/issues/search' });
      assert.strictEqual(mockedRequestInternal.mock.callCount(), 2);
      assert.strictEqual(mockedRequestExternal.mock.callCount(), 2);
    });

    it('should call axios request if axios is initialized', async () => {
      const mockedRequestFn = mock.fn();
      axiosCreateMock.mock.mockImplementation(
        () =>
          ({
            request: mockedRequestFn,
          }) as any,
      );

      await initializeAxios({
        [ScannerProperty.SonarHostUrl]: SONARCLOUD_URL,
        [ScannerProperty.SonarToken]: 'testToken',
      });

      const config = { url: '/api/issues/search' };

      fetch(config);
      assert.ok(
        mockedRequestFn.mock.calls.some(call => call.arguments[0]?.url === '/api/issues/search'),
      );
    });
  });
});
