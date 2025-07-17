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
import fsExtra from 'fs-extra';
import path from 'path';
import { PassThrough } from 'stream';
import * as tarStream from 'tar-stream';
import * as zlib from 'zlib';
import { SONAR_CACHE_DIR } from '../../src/constants';
import {
  extractArchive,
  getCacheDirectories,
  getCacheFileLocation,
  validateChecksum,
} from '../../src/file';
import { ScannerProperty } from '../../src/types';

const MOCKED_PROPERTIES = {
  [ScannerProperty.SonarUserHome]: '/sonar',
};

jest.mock('tar-stream');
jest.mock('zlib');

jest.mock('fs-extra', () => ({
  ensureDir: jest.fn(),
  remove: jest.fn(),
  createReadStream: jest.fn(),
  createWriteStream: jest.fn(),
  existsSync: jest.fn(),
  readFile: jest.fn(),
  mkdirSync: jest.fn(),
}));

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
    describe('zip', () => {
      it('should extract zip files to the specified directory', async () => {
        const archivePath = 'path/to/archive.zip';
        const extractPath = 'path/to/extract';

        await extractArchive(archivePath, extractPath);

        const mockAdmZipInstance = (AdmZip as jest.MockedClass<typeof AdmZip>).mock.instances[0];
        expect(mockAdmZipInstance.extractAllTo).toHaveBeenCalledWith(extractPath, true, true);
      });
    });

    describe('tar.gz', () => {
      const mockFilePath = path.join('path', 'to', 'file.tar.gz');
      const mockDestDir = path.join('path', 'to', 'dest');
      const mockFileHeader = { name: 'file.txt', mode: 0o777 };
      const mockOn = jest.fn();
      const mockPassThroughStream = new PassThrough();
      beforeEach(() => {
        mockPassThroughStream.on = jest.fn().mockImplementation((event, callback) => {
          if (event === 'data') {
            callback('mock data');
          } else if (event === 'end') {
            callback();
          }
        });

        mockPassThroughStream.resume = jest.fn();
        mockPassThroughStream.end = jest.fn();
        jest.spyOn(fsExtra, 'createWriteStream').mockReturnValue({
          on: jest.fn(),
          once: jest.fn(),
          emit: jest.fn(),
          end: jest.fn(),
          write: jest.fn(),
        } as unknown as fsExtra.WriteStream);
        jest
          .spyOn(fsExtra, 'createReadStream')
          .mockReturnValue({ pipe: jest.fn().mockReturnThis() } as unknown as fsExtra.ReadStream);
        jest
          .spyOn(tarStream, 'extract')
          .mockReturnValue({ on: mockOn } as unknown as tarStream.Extract);
        jest
          .spyOn(zlib, 'createGunzip')
          .mockReturnValue({ pipe: jest.fn().mockReturnThis() } as unknown as zlib.Gunzip);
      });

      it('should extract a .tar.gz file to the specified directory', async () => {
        mockOn.mockImplementation((event, callback) => {
          if (event === 'entry') {
            callback(mockFileHeader, mockPassThroughStream, jest.fn());
          }
          if (event === 'finish') {
            callback();
          }
        });

        await extractArchive(mockFilePath, mockDestDir);

        expect(fsExtra.createReadStream).toHaveBeenCalledWith(mockFilePath);
        expect(zlib.createGunzip).toHaveBeenCalled();
        expect(tarStream.extract).toHaveBeenCalled();
        expect(fsExtra.createWriteStream).toHaveBeenCalledWith(
          path.join(mockDestDir, mockFileHeader.name),
          {
            mode: 511,
          },
        );
      });

      it('should throw if extract fails', async () => {
        mockOn.mockImplementation((event, callback) => {
          if (event === 'error') {
            callback(new Error('mock error'));
          }
        });

        await expect(extractArchive(mockFilePath, mockDestDir)).rejects.toThrow('mock error');
      });
    });
  });

  describe('getCacheFileLocation', () => {
    it('should return the file path if the file exists', async () => {
      const checksum = 'e0ac3601005dfa1864f5392aabaf7d898b1b5bab854f1acb4491bcd806b76b0c';
      const filename = 'file.txt';
      const filePath = path.join(
        MOCKED_PROPERTIES[ScannerProperty.SonarUserHome],
        SONAR_CACHE_DIR,
        checksum,
        filename,
      );
      jest
        .spyOn(fsExtra, 'readFile')
        .mockImplementation((path, cb) => cb(null, Buffer.from('file content')));
      jest.spyOn(fsExtra, 'existsSync').mockReturnValue(true);

      const result = await getCacheFileLocation(MOCKED_PROPERTIES, {
        checksum,
        filename,
        alias: 'test',
      });

      expect(result).toEqual(filePath);
    });

    it('should validate and remove invalid cached file', async () => {
      const checksum = 'server-checksum';
      const filename = 'file.txt';
      jest.spyOn(fsExtra, 'existsSync').mockReturnValue(true);
      jest
        .spyOn(fsExtra, 'readFile')
        .mockImplementation((path, cb) => cb(null, Buffer.from('file content')));
      jest.spyOn(fsExtra, 'remove');

      await expect(
        getCacheFileLocation(MOCKED_PROPERTIES, {
          checksum,
          filename,
          alias: 'test',
        }),
      ).rejects.toThrow(
        'Checksum verification failed for /sonar/cache/server-checksum/file.txt. Expected checksum server-checksum but got e0ac3601005dfa1864f5392aabaf7d898b1b5bab854f1acb4491bcd806b76b0c',
      );

      expect(fsExtra.remove).toHaveBeenCalledWith('/sonar/cache/server-checksum/file.txt');
    });

    it('should return null if the file does not exist', async () => {
      const checksum = 'shahash';
      const filename = 'file.txt';

      jest.spyOn(fsExtra, 'existsSync').mockReturnValue(false);

      const result = await getCacheFileLocation(MOCKED_PROPERTIES, {
        checksum,
        filename,
        alias: 'test',
      });

      expect(result).toBeNull();
    });
  });

  describe('validateChecksum', () => {
    it('should read the file of the path provided', async () => {
      jest
        .spyOn(fsExtra, 'readFile')
        .mockImplementation((path, cb) => cb(null, Buffer.from('file content')));

      await validateChecksum(
        'path/to/file',
        'e0ac3601005dfa1864f5392aabaf7d898b1b5bab854f1acb4491bcd806b76b0c',
      );

      expect(fsExtra.readFile).toHaveBeenCalledWith('path/to/file', expect.any(Function));
    });

    it('should throw an error if the checksum does not match', async () => {
      jest
        .spyOn(fsExtra, 'readFile')
        .mockImplementation((path, cb) => cb(null, Buffer.from('file content')));

      await expect(validateChecksum('path/to/file', 'invalidchecksum')).rejects.toThrow(
        'Checksum verification failed for path/to/file. Expected checksum invalidchecksum but got e0ac3601005dfa1864f5392aabaf7d898b1b5bab854f1acb4491bcd806b76b0c',
      );
    });

    it('should throw an error if the checksum is not provided', async () => {
      await expect(validateChecksum('path/to/file', '')).rejects.toThrow('Checksum not provided');
    });

    it('should throw an error if the file cannot be read', async () => {
      jest
        .spyOn(fsExtra, 'readFile')
        .mockImplementation((path, cb) => cb(new Error('File not found'), Buffer.from('')));

      await expect(validateChecksum('path/to/file', 'checksum')).rejects.toThrow('File not found');
    });
  });

  describe('getCacheDirectories', () => {
    it('should return the cache directories', async () => {
      jest.spyOn(fsExtra, 'existsSync').mockImplementationOnce(() => true);
      jest.spyOn(fsExtra, 'mkdirSync');
      const { archivePath, unarchivePath } = await getCacheDirectories(MOCKED_PROPERTIES, {
        checksum: 'md5_test',
        filename: 'file.txt',
        alias: 'test',
      });

      expect(fsExtra.existsSync).toHaveBeenCalledWith(path.join('/', 'sonar', 'cache', 'md5_test'));
      expect(fsExtra.mkdirSync).not.toHaveBeenCalled();

      expect(archivePath).toEqual(path.join('/', 'sonar', 'cache', 'md5_test', 'file.txt'));
      expect(unarchivePath).toEqual(path.join('/', 'sonar', 'cache', 'md5_test', 'file.txt_extracted'));
    });
    it('should create the parent cache directory if it does not exist', async () => {
      jest.spyOn(fsExtra, 'existsSync').mockImplementationOnce(() => false);
      jest.spyOn(fsExtra, 'mkdirSync').mockImplementationOnce(() => undefined);
      await getCacheDirectories(MOCKED_PROPERTIES, {
        checksum: 'md5_test',
        filename: 'file.txt',
        alias: 'test',
      });

      expect(fsExtra.existsSync).toHaveBeenCalledWith(path.join('/', 'sonar', 'cache', 'md5_test'));
      expect(fsExtra.mkdirSync).toHaveBeenCalledWith(path.join('/', 'sonar', 'cache', 'md5_test'), {
        recursive: true,
      });
    });
  });
});
