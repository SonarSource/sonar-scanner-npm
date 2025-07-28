/*
 * sonar-scanner-npm
 * Copyright (C) 2022-2025 SonarSource SA
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
import { log } from '../../src/logging';
import { getProxyUrl, proxyUrlToJavaOptions } from '../../src/proxy';
import { ScannerProperties, ScannerProperty } from '../../src/types';

jest.mock('../../src/logging');

describe('proxy', () => {
  describe('getProxyUrl', () => {
    it('should not detect proxy when proxy host is not provided', () => {
      const properties: ScannerProperties = {
        [ScannerProperty.SonarHostUrl]: 'http://sq.some-company.com',
        [ScannerProperty.SonarScannerProxyPort]: '4234',
        [ScannerProperty.SonarScannerProxyUser]: 'user',
        [ScannerProperty.SonarScannerProxyPassword]: 'password',
      };
      getProxyUrl(properties);

      expect(getProxyUrl(properties)).toBeUndefined();
      expect(log).toHaveBeenCalledWith(
        'WARN',
        `Detecting proxy: Incomplete proxy configuration. Proxy host is missing.`,
      );
    });

    it('should detect proxy with only host on http endpoint', () => {
      const properties: ScannerProperties = {
        [ScannerProperty.SonarHostUrl]: 'http://sq.some-company.com',
        [ScannerProperty.SonarScannerProxyHost]: 'some-proxy.io',
      };
      getProxyUrl(properties);

      expect(getProxyUrl(properties)?.toString()).toBe('http://some-proxy.io/');
    });

    it('should detect proxy with only host on https endpoint', () => {
      const properties: ScannerProperties = {
        [ScannerProperty.SonarHostUrl]: 'https://sq.some-company.com',
        [ScannerProperty.SonarScannerProxyHost]: 'some-proxy.io',
      };
      getProxyUrl(properties);

      expect(getProxyUrl(properties)?.toString()).toBe('http://some-proxy.io/');
    });

    it('should detect proxy with host and port', () => {
      const properties: ScannerProperties = {
        [ScannerProperty.SonarHostUrl]: 'http://sq.some-company.com',
        [ScannerProperty.SonarScannerProxyHost]: 'some-proxy.io',
        [ScannerProperty.SonarScannerProxyPort]: '4234',
      };
      getProxyUrl(properties);

      expect(getProxyUrl(properties)?.toString()).toBe('http://some-proxy.io:4234/');
    });

    it('should detect proxy with host, port and authentication', () => {
      const properties: ScannerProperties = {
        [ScannerProperty.SonarHostUrl]: 'http://sq.some-company.com',
        [ScannerProperty.SonarScannerProxyHost]: 'some-proxy.io',
        [ScannerProperty.SonarScannerProxyPort]: '4234',
        [ScannerProperty.SonarScannerProxyUser]: 'user',
        [ScannerProperty.SonarScannerProxyPassword]: 'password',
      };
      getProxyUrl(properties);

      expect(getProxyUrl(properties)?.toString()).toBe('http://user:password@some-proxy.io:4234/');
    });
  });

  describe('proxyUrlToJavaOptions', () => {
    it('should return empty array when no proxy', () => {
      const options = proxyUrlToJavaOptions({
        [ScannerProperty.SonarHostUrl]: 'http://sq.some-company.com',
      });
      expect(options).toEqual([]);
    });

    it('should return java options for http proxy', () => {
      const options = proxyUrlToJavaOptions({
        [ScannerProperty.SonarHostUrl]: 'http://sq.some-company.com',
        [ScannerProperty.SonarScannerProxyHost]: 'some-proxy.io',
        [ScannerProperty.SonarScannerProxyPort]: '4234',
      });
      expect(options).toEqual([
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
      expect(options).toEqual([
        '-Dhttps.proxyHost=some-proxy.io',
        '-Dhttps.proxyPort=4234',
        '-Dhttps.proxyUser=user',
        '-Dhttps.proxyPassword=password',
      ]);
    });
  });
});
