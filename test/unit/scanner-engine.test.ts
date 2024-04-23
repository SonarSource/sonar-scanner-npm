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
import fs from 'fs';
import MockAdapter from 'axios-mock-adapter';
import { ScannerProperties, ScannerProperty } from '../../src/types';
import { fetchScannerEngine } from '../../src/scanner-engine';
import * as file from '../../src/file';
import * as request from '../../src/request';
import { Readable } from 'stream';
const mock = new MockAdapter(axios);

const MOCKED_PROPERTIES: ScannerProperties = {
  [ScannerProperty.SonarHostUrl]: 'http://sonarqube.com',
  [ScannerProperty.SonarToken]: 'dummy-token',
};

const MOCK_CACHE_DIRECTORIES = {
  archivePath: '/mocked-archive-path',
  unarchivePath: '/mocked-archive-path_extracted',
};

beforeEach(() => {
  jest.clearAllMocks();
  mock.reset();
});

describe('scanner-engine', () => {
  beforeEach(async () => {
    await request.initializeAxios(MOCKED_PROPERTIES);
    mock.onGet('/batch/index').reply(200, 'scanner-engine-1.2.3.zip|md5_test');
    mock.onGet('/batch/file?name=scanner-engine-1.2.3.zip').reply(() => {
      const readable = new Readable({
        read() {
          this.push('md5_test');
          this.push(null); // Indicates end of stream
        },
      });

      return [200, readable];
    });

    jest.spyOn(file, 'getCacheFileLocation').mockImplementation((md5, filename) => {
      return Promise.resolve(null);
    });

    jest.spyOn(file, 'extractArchive').mockImplementation((fromPath, toPath) => {
      return Promise.resolve();
    });

    jest.spyOn(file, 'validateChecksum').mockImplementation(() => {
      return Promise.resolve();
    });

    jest.spyOn(request, 'download').mockImplementation(() => {
      return Promise.resolve();
    });

    jest.spyOn(file, 'getCacheDirectories').mockResolvedValue(MOCK_CACHE_DIRECTORIES);
  });

  describe('fetchScannerEngine', () => {
    it('should fetch the latest version of the scanner engine', async () => {
      jest.spyOn(file, 'getCacheFileLocation');

      await fetchScannerEngine(MOCKED_PROPERTIES);

      expect(file.getCacheFileLocation).toHaveBeenCalledWith(MOCKED_PROPERTIES, {
        md5: 'md5_test',
        filename: 'scanner-engine-1.2.3.zip',
      });
    });

    describe('when the scanner engine is cached', () => {
      beforeEach(() => {
        jest.spyOn(file, 'getCacheFileLocation').mockResolvedValue('mocked/path/to/scanner-engine');

        jest.spyOn(file, 'extractArchive');

        jest.spyOn(request, 'download');
      });

      it('should use the cached scanner engine', async () => {
        const scannerEngine = await fetchScannerEngine(MOCKED_PROPERTIES);

        expect(file.getCacheFileLocation).toHaveBeenCalledWith(MOCKED_PROPERTIES, {
          md5: 'md5_test',
          filename: 'scanner-engine-1.2.3.zip',
        });
        expect(request.download).not.toHaveBeenCalled();
        expect(file.extractArchive).not.toHaveBeenCalled();

        expect(scannerEngine).toEqual('mocked/path/to/scanner-engine');
      });
    });
    describe('when the scanner engine is not cached', () => {
      it('should download and extract the scanner engine', async () => {
        const scannerEngine = await fetchScannerEngine(MOCKED_PROPERTIES);

        expect(file.getCacheFileLocation).toHaveBeenCalledWith(
          'md5_test',
          'scanner-engine-1.2.3.zip',
        );
        expect(request.download).toHaveBeenCalledTimes(1);
        expect(file.extractArchive).toHaveBeenCalledTimes(1);

        expect(scannerEngine).toEqual(
          'mocked/path/to/sonar/cache/md5_test/scanner-engine-1.2.3.zip_extracted',
        );
      });
    });
  });
});
