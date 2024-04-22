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
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { extractArchive, getCachedFileLocation } from '../../src/file';
import { SONAR_CACHE_DIR } from '../../src/constants';
import { Readable } from 'stream';

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

describe('extractArchive', () => {
  it('should extract zip files to the specified directory', async () => {
    const archivePath = 'path/to/archive.zip';
    const extractPath = 'path/to/extract';

    await extractArchive(archivePath, extractPath);

    const mockAdmZipInstance = (AdmZip as jest.MockedClass<typeof AdmZip>).mock.instances[0];
    expect(mockAdmZipInstance.extractAllTo).toHaveBeenCalledWith(extractPath, true);
  });
});

describe('getCachedFileLocation', () => {
  it('should return the file path if the file exists', async () => {
    const md5 = 'md5hash';
    const filename = 'file.txt';
    const filePath = path.join(SONAR_CACHE_DIR, md5, filename);

    jest.spyOn(fs, 'existsSync').mockReturnValue(true);

    const result = await getCachedFileLocation(md5, filename);

    expect(result).toEqual(filePath);
  });

  it('should return null if the file does not exist', async () => {
    const md5 = 'md5hash';
    const filename = 'file.txt';

    jest.spyOn(fs, 'existsSync').mockReturnValue(false);

    const result = await getCachedFileLocation(md5, filename);

    expect(result).toBeNull();
  });
});
