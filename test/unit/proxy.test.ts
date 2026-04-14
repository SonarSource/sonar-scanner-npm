/*
 * sonar-scanner-npm
 * Copyright (C) SonarSource Sàrl
 * mailto:info AT sonarsource DOT com
 *
 * You can redistribute and/or modify this program under the terms of
 * the Sonar Source-Available License Version 1, as published by SonarSource Sàrl.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the Sonar Source-Available License for more details.
 *
 * You should have received a copy of the Sonar Source-Available License
 * along with this program; if not, see https://sonarsource.com/license/ssal/
 */
import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import { getProxyUrl, proxyUrlToJavaOptions } from '../../src/proxy';
import { type ScannerProperties, ScannerProperty } from '../../src/types';

// Mock console.log to suppress output and capture log calls
const mockLog = mock.fn();
mock.method(console, 'log', mockLog);

beforeEach(() => {
  mockLog.mock.resetCalls();
});

describe('proxy', () => {
  describe('getProxyUrl', () => {
    it('should not detect proxy when proxy host is not provided', () => {
      const properties: ScannerProperties = {
        [ScannerProperty.SonarHostUrl]: 'http://sq.some-company.com',
        [ScannerProperty.SonarScannerProxyPort]: '4234',
        [ScannerProperty.SonarScannerProxyUser]: 'user',
        [ScannerProperty.SonarScannerProxyPassword]: 'password',
      };
      const result = getProxyUrl(properties);

      assert.strictEqual(result, undefined);
      // Check that warning was logged
      assert.ok(
        mockLog.mock.calls.some(call =>
          call.arguments.some(
            (arg: unknown) =>
              typeof arg === 'string' &&
              arg.includes('Incomplete proxy configuration. Proxy host is missing'),
          ),
        ),
      );
    });

    it('should detect proxy with only host on http endpoint', () => {
      const properties: ScannerProperties = {
        [ScannerProperty.SonarHostUrl]: 'http://sq.some-company.com',
        [ScannerProperty.SonarScannerProxyHost]: 'some-proxy.io',
      };

      assert.strictEqual(getProxyUrl(properties)?.toString(), 'http://some-proxy.io/');
    });

    it('should detect proxy with only host on https endpoint', () => {
      const properties: ScannerProperties = {
        [ScannerProperty.SonarHostUrl]: 'https://sq.some-company.com',
        [ScannerProperty.SonarScannerProxyHost]: 'some-proxy.io',
      };

      assert.strictEqual(getProxyUrl(properties)?.toString(), 'http://some-proxy.io/');
    });

    it('should detect proxy with host and port', () => {
      const properties: ScannerProperties = {
        [ScannerProperty.SonarHostUrl]: 'http://sq.some-company.com',
        [ScannerProperty.SonarScannerProxyHost]: 'some-proxy.io',
        [ScannerProperty.SonarScannerProxyPort]: '4234',
      };

      assert.strictEqual(getProxyUrl(properties)?.toString(), 'http://some-proxy.io:4234/');
    });

    it('should detect proxy with host, port and authentication', () => {
      const properties: ScannerProperties = {
        [ScannerProperty.SonarHostUrl]: 'http://sq.some-company.com',
        [ScannerProperty.SonarScannerProxyHost]: 'some-proxy.io',
        [ScannerProperty.SonarScannerProxyPort]: '4234',
        [ScannerProperty.SonarScannerProxyUser]: 'user',
        [ScannerProperty.SonarScannerProxyPassword]: 'password',
      };

      assert.strictEqual(
        getProxyUrl(properties)?.toString(),
        'http://user:password@some-proxy.io:4234/',
      );
    });
  });

  describe('proxyUrlToJavaOptions', () => {
    it('should return empty array when no proxy', () => {
      const options = proxyUrlToJavaOptions({
        [ScannerProperty.SonarHostUrl]: 'http://sq.some-company.com',
      });
      assert.deepStrictEqual(options, []);
    });

    it('should return java options for http proxy', () => {
      const options = proxyUrlToJavaOptions({
        [ScannerProperty.SonarHostUrl]: 'http://sq.some-company.com',
        [ScannerProperty.SonarScannerProxyHost]: 'some-proxy.io',
        [ScannerProperty.SonarScannerProxyPort]: '4234',
      });
      assert.deepStrictEqual(options, [
        '-Dhttp.proxyHost=some-proxy.io',
        '-Dhttp.proxyPort=4234',
        '-Dhttp.proxyUser=',
        '-Dhttp.proxyPassword=',
      ]);
    });

    it('should return java options for https proxy', () => {
      const options = proxyUrlToJavaOptions({
        [ScannerProperty.SonarHostUrl]: 'https://sq.some-company.com',
        [ScannerProperty.SonarScannerProxyHost]: 'some-proxy.io',
        [ScannerProperty.SonarScannerProxyPort]: '4234',
        [ScannerProperty.SonarScannerProxyUser]: 'user',
        [ScannerProperty.SonarScannerProxyPassword]: 'password',
      });
      assert.deepStrictEqual(options, [
        '-Dhttps.proxyHost=some-proxy.io',
        '-Dhttps.proxyPort=4234',
        '-Dhttps.proxyUser=user',
        '-Dhttps.proxyPassword=password',
      ]);
    });
  });
});
