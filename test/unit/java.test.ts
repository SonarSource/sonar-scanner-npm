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
import path from 'path';
import fs from 'fs';
import MockAdapter from 'axios-mock-adapter';
import {
  fetchServerVersion,
  handleJREProvisioning,
  serverSupportsJREProvisioning,
} from '../../src/java';
import * as request from '../../src/request';
import * as file from '../../src/file';
import { JreMetaData, PlatformInfo, ScannerProperties, ScannerProperty } from '../../src/types';
import { SONARQUBE_JRE_PROVISIONING_MIN_VERSION } from '../../src/constants';
import axios from 'axios';

const mock = new MockAdapter(axios);

const MOCKED_PROPERTIES: ScannerProperties = {
  [ScannerProperty.SonarHostUrl]: 'http://sonarqube.com',
  [ScannerProperty.SonarToken]: 'dummy-token',
};

beforeEach(() => {
  jest.clearAllMocks();
  mock.reset();
  jest.spyOn(request, 'fetch');
});

describe('java', () => {
  describe('version should be detected correctly', () => {
    it('the SonarQube version should be fetched correctly when new endpoint does not exist', async () => {
      const token = 'dummy-token';
      mock.onGet('http://sonarqube.com/api/server/version').reply(200, '3.2.2');

      mock.onGet('http://sonarqube.com/api/v2/analysis/version').reply(404, 'Not Found');

      const serverSemver = await fetchServerVersion('http://sonarqube.com', MOCKED_PROPERTIES);
      expect(serverSemver.toString()).toEqual('3.2.2');
      expect(request.fetch).toHaveBeenCalledTimes(2);
    });

    it('the SonarQube version should be fetched correctly using the new endpoint', async () => {
      mock.onGet('http://sonarqube.com/api/server/version').reply(200, '3.2.1.12313');

      const serverSemver = await fetchServerVersion('http://sonarqube.com', MOCKED_PROPERTIES);
      expect(serverSemver.toString()).toEqual('3.2.1');
    });

    it('should fail if both endpoints do not work', async () => {
      mock.onGet('http://sonarqube.com/api/server/version').reply(404, 'Not Found');
      mock.onGet('http://sonarqube.com/api/v2/server/version').reply(404, 'Not Found');

      expect(async () => {
        await fetchServerVersion('http://sonarqube.com', MOCKED_PROPERTIES);
      }).rejects.toBeDefined();
    });

    it('should fail if version can not be parsed', async () => {
      mock
        .onGet('http://sonarqube.com/api/server/version')
        .reply(200, '<!DOCTYPE><HTML><BODY>FORBIDDEN</BODY></HTML>');

      expect(async () => {
        await fetchServerVersion('http://sonarqube.com', MOCKED_PROPERTIES);
      }).rejects.toBeDefined();
    });
  });

  describe('JRE provisioning should be detected correctly', () => {
    it('should return true for sonarcloud', async () => {
      expect(await serverSupportsJREProvisioning({})).toBe(true);
    });
    it(`should return true for SQ version >= ${SONARQUBE_JRE_PROVISIONING_MIN_VERSION}`, async () => {
      mock.onGet('https://next.sonarqube.com/api/server/version').reply(200, '10.5.0');
      expect(
        await serverSupportsJREProvisioning({
          [ScannerProperty.SonarHostUrl]: 'https://next.sonarqube.com',
        }),
      ).toBe(true);
    });
    it(`should return false for SQ version < ${SONARQUBE_JRE_PROVISIONING_MIN_VERSION}`, async () => {
      // Define the behavior of the GET request
      mock.onGet('https://next.sonarqube.com/api/server/version').reply(200, '9.9.9');
      expect(
        await serverSupportsJREProvisioning({
          [ScannerProperty.SonarHostUrl]: 'https://next.sonarqube.com',
        }),
      ).toBe(false);
    });
  });

  describe('when JRE provisioning is supported', () => {
    const platformInfo: PlatformInfo = { os: 'linux', arch: 'arm64' };
    const serverResponse: JreMetaData = {
      filename: 'mock-jre.tar.gz',
      javaPath: 'jre/bin/java',
      md5: 'd41d8cd98f00b204e9800998ecf8427e',
    };
    beforeEach(() => {
      jest.spyOn(file, 'getCachedFileLocation').mockImplementation((md5, filename) => {
        // Your mock implementation here
        return Promise.resolve('mocked/path/to/file');
      });

      jest.spyOn(file, 'extractArchive').mockImplementation((fromPath, toPath) => {
        // Your mock implementation here
        return Promise.resolve();
      });

      mock
        .onGet(
          `https://sonarcloud.io/api/v2/analysis/jres?os=${platformInfo.os}&arch=${platformInfo.arch}`,
        )
        .reply(200, serverResponse);

      mock
        .onGet(`https://sonarcloud.io/api/v2/analysis/jres/${serverResponse.filename}`)
        .reply(200, fs.createReadStream(path.resolve(__dirname, '../unit/mocks/mock-jre.tar.gz')));
    });

    describe('when the JRE is cached', () => {
      it('should fetch the latest supported JRE and use the cached version', async () => {
        await handleJREProvisioning({ [ScannerProperty.SonarToken]: 'mock-token' }, platformInfo);

        expect(request.fetch).toHaveBeenCalledTimes(1);

        // check for the cache
        expect(file.getCachedFileLocation).toHaveBeenCalledTimes(1);

        expect(file.extractArchive).not.toHaveBeenCalled();
      });
    });

    describe('when the JRE is not cached', () => {
      beforeEach(() => {
        jest.spyOn(file, 'getCachedFileLocation').mockImplementation((md5, filename) => {
          // Your mock implementation here
          return Promise.resolve(null);
        });
      });
      it('should download the JRE', async () => {
        await handleJREProvisioning({ [ScannerProperty.SonarToken]: 'mock-token' }, platformInfo);

        expect(request.fetch).toHaveBeenCalledTimes(2);

        // check for the cache
        expect(file.getCachedFileLocation).toHaveBeenCalledTimes(1);

        expect(file.extractArchive).toHaveBeenCalledTimes(1);
      });
    });
  });
});
