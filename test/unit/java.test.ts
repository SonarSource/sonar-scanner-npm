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

import { ServerMock } from './mocks/ServerMock';
import { fetchServerVersion, getEndpoint } from '../../src/java';
import { fetch } from '../../src/request';
import { ScannerProperty } from '../../src/types';

const serverHandler = new ServerMock();

beforeEach(() => {
  jest.clearAllMocks();
  serverHandler.reset();
});

describe('java', () => {
  describe('endpoint should be detected correctly', () => {
    it('should detect SonarCloud', () => {
      const expected = {
        isSonarCloud: true,
        sonarHostUrl: 'https://sonarcloud.io',
      };

      // SonarCloud used by default
      expect(getEndpoint({})).toEqual(expected);

      // Backward-compatible use-case
      expect(
        getEndpoint({
          [ScannerProperty.SonarHostUrl]: 'https://sonarcloud.io',
        }),
      ).toEqual(expected);

      // Using www.
      expect(
        getEndpoint({
          [ScannerProperty.SonarHostUrl]: 'https://www.sonarcloud.io',
        }),
      ).toEqual(expected);

      // Using trailing slash (ensures trailing slash is dropped)
      expect(
        getEndpoint({
          [ScannerProperty.SonarHostUrl]: 'https://www.sonarcloud.io/',
        }),
      ).toEqual(expected);
    });

    it('should detect SonarCloud with custom URL', () => {
      const endpoint = getEndpoint({
        [ScannerProperty.SonarHostUrl]: 'https://sonarcloud.io/',
        [ScannerProperty.SonarScannerSonarCloudURL]: 'http://that-is-a-sonarcloud-custom-url.com',
      });

      expect(endpoint).toEqual({
        isSonarCloud: true,
        sonarHostUrl: 'http://that-is-a-sonarcloud-custom-url.com',
      });
    });

    it('should detect SonarQube', () => {
      const endpoint = getEndpoint({
        [ScannerProperty.SonarHostUrl]: 'https://next.sonarqube.com',
      });

      expect(endpoint).toEqual({
        isSonarCloud: false,
        sonarHostUrl: 'https://next.sonarqube.com',
      });
    });

    it('should ignore SonarCloud custom URL if sonar host URL does not match sonarcloud', () => {
      const endpoint = getEndpoint({
        [ScannerProperty.SonarHostUrl]: 'https://next.sonarqube.com',
        [ScannerProperty.SonarScannerSonarCloudURL]: 'http://that-is-a-sonarcloud-custom-url.com',
      });

      expect(endpoint).toEqual({
        isSonarCloud: false,
        sonarHostUrl: 'https://next.sonarqube.com',
      });
    });
  });

  describe('version should be detected correctly', () => {
    it('the SonarQube version should be fetched correctly when new endpoint does not exist', async () => {
      serverHandler.mockServerErrorResponse();
      serverHandler.mockServerVersionResponse('3.2.2');

      const serverSemver = await fetchServerVersion('http://sonarqube.com', 'dummy-token');
      expect(serverSemver.toString()).toEqual('3.2.2');
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('the SonarQube version should be fetched correctly using the new endpoint', async () => {
      serverHandler.mockServerVersionResponse('3.2.1.12313');

      const serverSemver = await fetchServerVersion('http://sonarqube.com', 'dummy-token');
      expect(serverSemver.toString()).toEqual('3.2.1');
    });

    it('should fail if both endpoints do not work', async () => {
      serverHandler.mockServerErrorResponse();
      serverHandler.mockServerErrorResponse();

      expect(async () => {
        await fetchServerVersion('http://sonarqube.com', 'dummy-token');
      }).rejects.toBeDefined();
    });

    it('should fail if version can not be parsed', async () => {
      serverHandler.mockServerVersionResponse('<!DOCTYPE><HTML><BODY>FORBIDDEN</BODY></HTML>');

      expect(async () => {
        await fetchServerVersion('http://sonarqube.com', 'dummy-token');
      }).rejects.toBeDefined();
    });
  });
});
