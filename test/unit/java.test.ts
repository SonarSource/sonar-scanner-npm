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

import { fetchServerVersion } from '../../src/java';
import { fetch } from '../../src/request';
import { ScannerProperties, ScannerProperty } from '../../src/types';
import { ServerMock } from './mocks/ServerMock';

jest.mock('../../src/request');

const serverHandler = new ServerMock();

const MOCKED_PROPERTIES: ScannerProperties = {
  [ScannerProperty.SonarHostUrl]: 'http://sonarqube.com',
  [ScannerProperty.SonarToken]: 'dummy-token',
};

beforeEach(() => {
  jest.clearAllMocks();
  serverHandler.reset();
});

describe('java', () => {
  describe('version should be detected correctly', () => {
    it('the SonarQube version should be fetched correctly when new endpoint does not exist', async () => {
      serverHandler.mockServerErrorResponse();
      serverHandler.mockServerVersionResponse('3.2.2');

      const serverSemver = await fetchServerVersion('http://sonarqube.com', MOCKED_PROPERTIES);
      expect(serverSemver.toString()).toEqual('3.2.2');
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('the SonarQube version should be fetched correctly using the new endpoint', async () => {
      serverHandler.mockServerVersionResponse('3.2.1.12313');

      const serverSemver = await fetchServerVersion('http://sonarqube.com', MOCKED_PROPERTIES);
      expect(serverSemver.toString()).toEqual('3.2.1');
    });

    it('should fail if both endpoints do not work', async () => {
      serverHandler.mockServerErrorResponse();
      serverHandler.mockServerErrorResponse();

      expect(async () => {
        await fetchServerVersion('http://sonarqube.com', MOCKED_PROPERTIES);
      }).rejects.toBeDefined();
    });

    it('should fail if version can not be parsed', async () => {
      serverHandler.mockServerVersionResponse('<!DOCTYPE><HTML><BODY>FORBIDDEN</BODY></HTML>');

      expect(async () => {
        await fetchServerVersion('http://sonarqube.com', MOCKED_PROPERTIES);
      }).rejects.toBeDefined();
    });
  });
});
