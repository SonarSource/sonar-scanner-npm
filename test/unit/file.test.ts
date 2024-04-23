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
import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import {
  extractArchive,
  getCacheDirectories,
  getCacheFileLocation,
  validateChecksum,
} from '../../src/file';
import { ScannerProperty } from '../../src/types';
import { SONAR_CACHE_DIR } from '../../src/constants';

const MOCKED_PROPERTIES = {
  [ScannerProperty.SonarUserHome]: '/path/to/sonar/user/home',
};

// Mock the filesystem
jest.mock('fs', () => ({
  createReadStream: jest.fn().mockImplementation(() => {
    const mockStream = new Readable({
      read() {
        process.nextTick(() => this.emit('end')); // emit 'end' on next tick
      },
    });
    mockStream.pipe = jest.fn().mockReturnThis();
    return mockStream;
  }),
  createWriteStream: jest.fn(),
  existsSync: jest.fn(),
  readFile: jest.fn(),
  mkdirSync: jest.fn(),
}));

jest.mock('fs-extra', () => ({}));

jest.mock('adm-zip', () => {
  const MockAdmZip = jest.fn();
  MockAdmZip.prototype.extractAllTo = jest.fn();
  return MockAdmZip;
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('file', () => {
  describe('extractArchive', () => {
    it('should extract zip files to the specified directory', async () => {
      const archivePath = 'path/to/archive.zip';
      const extractPath = 'path/to/extract';

      await extractArchive(archivePath, extractPath);

      const mockAdmZipInstance = (AdmZip as jest.MockedClass<typeof AdmZip>).mock.instances[0];
      expect(mockAdmZipInstance.extractAllTo).toHaveBeenCalledWith(extractPath, true, true);
    });
  });

  describe('getCacheFileLocation', () => {
    it('should return the file path if the file exists', async () => {
      const md5 = 'md5hash';
      const filename = 'file.txt';
      const filePath = path.join(
        MOCKED_PROPERTIES[ScannerProperty.SonarUserHome],
        SONAR_CACHE_DIR,
        md5,
        filename,
      );

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);

      const result = await getCacheFileLocation(MOCKED_PROPERTIES, { md5, filename });

      expect(result).toEqual(filePath);
    });

    it('should return null if the file does not exist', async () => {
      const md5 = 'md5hash';
      const filename = 'file.txt';

      jest.spyOn(fs, 'existsSync').mockReturnValue(false);

      const result = await getCacheFileLocation(MOCKED_PROPERTIES, { md5, filename });

      expect(result).toBeNull();
    });
  });

  describe('validateChecksum', () => {
    it('should read the file of the path provided', async () => {
      jest
        .spyOn(fs, 'readFile')
        .mockImplementation((path, cb) => cb(null, Buffer.from('file content')));

      await validateChecksum('path/to/file', 'd10b4c3ff123b26dc068d43a8bef2d23');

      expect(fs.readFile).toHaveBeenCalledWith('path/to/file', expect.any(Function));
    });

    it('should throw an error if the checksum does not match', async () => {
      jest
        .spyOn(fs, 'readFile')
        .mockImplementation((path, cb) => cb(null, Buffer.from('file content')));

      await expect(validateChecksum('path/to/file', 'invalidchecksum')).rejects.toThrow(
        'Checksum verification failed for path/to/file. Expected checksum invalidchecksum but got d10b4c3ff123b26dc068d43a8bef2d23',
      );
    });

    it('should throw an error if the checksum is not provided', async () => {
      await expect(validateChecksum('path/to/file', '')).rejects.toThrow('Checksum not provided');
    });

    it('should throw an error if the file cannot be read', async () => {
      jest
        .spyOn(fs, 'readFile')
        .mockImplementation((path, cb) => cb(new Error('File not found'), Buffer.from('')));

      await expect(validateChecksum('path/to/file', 'checksum')).rejects.toThrow('File not found');
    });
  });

  describe('getCacheDirectories', () => {
    it('should return the cache directories', async () => {
      jest.spyOn(fs, 'existsSync').mockImplementationOnce(() => true);
      jest.spyOn(fs, 'mkdirSync');
      const { archivePath, unarchivePath } = await getCacheDirectories(MOCKED_PROPERTIES, {
        md5: 'md5_test',
        filename: 'file.txt',
      });

      expect(fs.existsSync).toHaveBeenCalledWith('/path/to/sonar/user/home/cache/md5_test');
      expect(fs.mkdirSync).not.toHaveBeenCalled();

      expect(archivePath).toEqual('/path/to/sonar/user/home/cache/md5_test/file.txt');
      expect(unarchivePath).toEqual('/path/to/sonar/user/home/cache/md5_test/file.txt_extracted');
    });
    it('should create the parent cache directory if it does not exist', async () => {
      jest.spyOn(fs, 'existsSync').mockImplementationOnce(() => false);
      jest.spyOn(fs, 'mkdirSync').mockImplementationOnce(() => undefined);
      await getCacheDirectories(MOCKED_PROPERTIES, { md5: 'md5_test', filename: 'file.txt' });

      expect(fs.existsSync).toHaveBeenCalledWith('/path/to/sonar/user/home/cache/md5_test');
      expect(fs.mkdirSync).toHaveBeenCalledWith('/path/to/sonar/user/home/cache/md5_test', {
        recursive: true,
      });
    });
  });
});
