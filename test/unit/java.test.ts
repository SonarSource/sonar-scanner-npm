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
import MockAdapter from 'axios-mock-adapter';
import fs from 'fs';
import path from 'path';
import { API_V2_JRE_ENDPOINT, SONARQUBE_JRE_PROVISIONING_MIN_VERSION } from '../../src/constants';
import * as file from '../../src/file';
import { fetchJRE, fetchServerVersion, serverSupportsJREProvisioning } from '../../src/java';
import * as request from '../../src/request';
import { JreMetaData, ScannerProperties, ScannerProperty } from '../../src/types';

const mock = new MockAdapter(axios);

const MOCKED_PROPERTIES: ScannerProperties = {
  [ScannerProperty.SonarHostUrl]: 'http://sonarqube.com',
  [ScannerProperty.SonarScannerOs]: 'linux',
  [ScannerProperty.SonarScannerArch]: 'arm64',
};

beforeEach(() => {
  jest.clearAllMocks();
  request.initializeAxios(MOCKED_PROPERTIES);
  mock.reset();
  jest.spyOn(request, 'fetch');
  jest.spyOn(request, 'download');
});

describe('java', () => {
  describe('version should be detected correctly', () => {
    it('the SonarQube version should be fetched correctly when new endpoint does not exist', async () => {
      mock.onGet('/api/server/version').reply(200, '3.2.2');

      mock.onGet('/api/v2/analysis/version').reply(404, 'Not Found');

      const serverSemver = await fetchServerVersion();
      expect(serverSemver.toString()).toEqual('3.2.2');
      expect(request.fetch).toHaveBeenCalledTimes(2);
    });

    it('the SonarQube version should be fetched correctly using the new endpoint', async () => {
      mock.onGet('/api/server/version').reply(200, '3.2.1.12313');

      const serverSemver = await fetchServerVersion();
      expect(serverSemver.toString()).toEqual('3.2.1');
    });

    it('should fail if both endpoints do not work', async () => {
      mock.onGet('/api/server/version').reply(404, 'Not Found');
      mock.onGet('/api/v2/server/version').reply(404, 'Not Found');

      expect(async () => {
        await fetchServerVersion();
      }).rejects.toBeDefined();
    });

    it('should fail if version can not be parsed', async () => {
      mock.onGet('/api/server/version').reply(200, '<!DOCTYPE><HTML><BODY>FORBIDDEN</BODY></HTML>');

      expect(async () => {
        await fetchServerVersion();
      }).rejects.toBeDefined();
    });
  });

  describe('JRE provisioning should be detected correctly', () => {
    it('should return true for sonarcloud', async () => {
      expect(
        await serverSupportsJREProvisioning({
          ...MOCKED_PROPERTIES,
          [ScannerProperty.SonarScannerInternalIsSonarCloud]: 'true',
        }),
      ).toBe(false); // TODO: return to true once SC has the new provisioning mechanism in place
    });

    it(`should return true for SQ version >= ${SONARQUBE_JRE_PROVISIONING_MIN_VERSION}`, async () => {
      mock.onGet('/api/server/version').reply(200, '10.5.0');
      expect(await serverSupportsJREProvisioning(MOCKED_PROPERTIES)).toBe(true);
    });

    it(`should return false for SQ version < ${SONARQUBE_JRE_PROVISIONING_MIN_VERSION}`, async () => {
      // Define the behavior of the GET request
      mock.onGet('/api/server/version').reply(200, '9.9.9');
      expect(await serverSupportsJREProvisioning(MOCKED_PROPERTIES)).toBe(false);
    });
  });

  describe('when JRE provisioning is supported', () => {
    const serverResponse: JreMetaData = {
      filename: 'mock-jre.tar.gz',
      javaPath: 'jre/bin/java',
      md5: 'd41d8cd98f00b204e9800998ecf8427e',
    };
    beforeEach(() => {
      jest.spyOn(file, 'getCacheFileLocation').mockResolvedValue('mocked/path/to/file');

      jest.spyOn(file, 'extractArchive').mockResolvedValue(undefined);

      mock
        .onGet(API_V2_JRE_ENDPOINT, {
          params: {
            os: MOCKED_PROPERTIES[ScannerProperty.SonarScannerOs],
            arch: MOCKED_PROPERTIES[ScannerProperty.SonarScannerArch],
          },
        })
        .reply(200, serverResponse);

      mock
        .onGet(`${API_V2_JRE_ENDPOINT}/${serverResponse.filename}`)
        .reply(200, fs.createReadStream(path.resolve(__dirname, '../unit/mocks/mock-jre.tar.gz')));
    });

    describe('when the JRE is cached', () => {
      it('should fetch the latest supported JRE and use the cached version', async () => {
        await fetchJRE(MOCKED_PROPERTIES);

        expect(request.fetch).toHaveBeenCalledTimes(1);
        expect(request.download).not.toHaveBeenCalled();

        // check for the cache
        expect(file.getCacheFileLocation).toHaveBeenCalledTimes(1);

        expect(file.extractArchive).not.toHaveBeenCalled();
      });
    });

    describe('when the JRE is not cached', () => {
      const mockCacheDirectories = {
        archivePath: '/mocked-archive-path',
        unarchivePath: '/mocked-archive-path_extracted',
      };
      beforeEach(() => {
        jest.spyOn(file, 'getCacheFileLocation').mockResolvedValue(null);
        jest.spyOn(file, 'getCacheDirectories').mockResolvedValue(mockCacheDirectories);
        jest.spyOn(file, 'validateChecksum').mockResolvedValue(undefined);
        jest.spyOn(request, 'download').mockResolvedValue(undefined);
      });

      it('should download the JRE', async () => {
        await fetchJRE({ ...MOCKED_PROPERTIES });

        expect(request.fetch).toHaveBeenCalledWith({
          url: API_V2_JRE_ENDPOINT,
          params: {
            os: MOCKED_PROPERTIES[ScannerProperty.SonarScannerOs],
            arch: MOCKED_PROPERTIES[ScannerProperty.SonarScannerArch],
          },
        });

        expect(file.getCacheFileLocation).toHaveBeenCalledTimes(1);

        expect(request.download).toHaveBeenCalledWith(
          `${API_V2_JRE_ENDPOINT}/${serverResponse.filename}`,
          mockCacheDirectories.archivePath,
        );

        expect(file.validateChecksum).toHaveBeenCalledTimes(1);

        expect(file.extractArchive).toHaveBeenCalledTimes(1);
      });
    });
  });
});
