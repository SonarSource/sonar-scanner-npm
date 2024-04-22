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

const mock = new MockAdapter(axios);

const MOCKED_PROPERTIES: ScannerProperties = {
  [ScannerProperty.SonarHostUrl]: 'http://sonarqube.com',
  [ScannerProperty.SonarToken]: 'dummy-token',
};

jest.mock('../../src/constants', () => ({
  ...jest.requireActual('../../src/constants'),
  SONAR_CACHE_DIR: 'mocked/path/to/sonar/cache',
}));

beforeEach(() => {
  jest.clearAllMocks();
  mock.reset();
});

describe('scanner-engine', () => {
  beforeEach(() => {
    mock.onGet('http://sonarqube.com/batch/index').reply(200, 'scanner-engine-1.2.3.zip|md5_test');
  });

  describe('fetchScannerEngine', () => {
    it('should fetch the latest version of the scanner engine', async () => {
      jest.spyOn(file, 'getCachedFileLocation');

      await fetchScannerEngine(MOCKED_PROPERTIES);

      expect(file.getCachedFileLocation).toHaveBeenCalledWith(
        'md5_test',
        'scanner-engine-1.2.3.zip',
      );
    });

    describe('when the scanner engine is cached', () => {
      beforeEach(() => {
        jest.spyOn(file, 'getCachedFileLocation').mockImplementation((md5, filename) => {
          return Promise.resolve('mocked/path/to/scanner-engine');
        });

        jest.spyOn(file, 'extractArchive');

        jest.spyOn(file, 'download');
      });

      it('should use the cached scanner engine', async () => {
        const scannerEngine = await fetchScannerEngine(MOCKED_PROPERTIES);

        expect(file.getCachedFileLocation).toHaveBeenCalledWith(
          'md5_test',
          'scanner-engine-1.2.3.zip',
        );
        expect(file.download).not.toHaveBeenCalled();
        expect(file.extractArchive).not.toHaveBeenCalled();

        expect(scannerEngine).toEqual('mocked/path/to/scanner-engine');
      });
    });
    describe('when the scanner engine is not cached', () => {
      beforeEach(() => {
        jest.spyOn(file, 'getCachedFileLocation').mockImplementation((md5, filename) => {
          return Promise.resolve(null);
        });

        jest.spyOn(file, 'extractArchive').mockImplementation((fromPath, toPath) => {
          return Promise.resolve();
        });

        jest.spyOn(file, 'download').mockImplementation(() => {
          return Promise.resolve();
        });
      });

      it('should create the parent cache directory if it does not exist', async () => {
        jest.spyOn(fs, 'existsSync').mockImplementationOnce(() => false);
        jest.spyOn(fs, 'mkdirSync').mockImplementationOnce(() => undefined);
        await fetchScannerEngine(MOCKED_PROPERTIES);

        expect(fs.existsSync).toHaveBeenCalledWith('mocked/path/to/sonar/cache/md5_test');
        expect(fs.mkdirSync).toHaveBeenCalledWith('mocked/path/to/sonar/cache/md5_test', {
          recursive: true,
        });
      });

      it('should download and extract the scanner engine', async () => {
        const scannerEngine = await fetchScannerEngine(MOCKED_PROPERTIES);

        expect(file.getCachedFileLocation).toHaveBeenCalledWith(
          'md5_test',
          'scanner-engine-1.2.3.zip',
        );
        expect(file.download).toHaveBeenCalledTimes(1);
        expect(file.extractArchive).toHaveBeenCalledTimes(1);

        expect(scannerEngine).toEqual(
          'mocked/path/to/sonar/cache/md5_test/scanner-engine-1.2.3.zip_extracted',
        );
      });
    });
  });
});
