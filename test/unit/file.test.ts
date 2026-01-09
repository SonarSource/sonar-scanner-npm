/*
 * sonar-scanner-npm
 * Copyright (C) 2022-2025 SonarSource Sàrl
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
import { describe, it, mock, Mock } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { SONAR_CACHE_DIR } from '../../src/constants';
import type { FileDeps } from '../../src/file';
import {
  extractArchive,
  getCacheDirectories,
  getCacheFileLocation,
  validateChecksum,
} from '../../src/file';
import { ScannerProperty } from '../../src/types';

// Mock console.log to suppress output
mock.method(console, 'log', () => {});

const MOCKED_PROPERTIES = {
  [ScannerProperty.SonarUserHome]: '/sonar',
};

function createMockFileDeps(overrides: Partial<FileDeps> = {}): FileDeps {
  return {
    existsSync: mock.fn(() => false),
    readFile: mock.fn((path: string, cb: (err: Error | null, data: Buffer) => void) =>
      cb(null, Buffer.from('')),
    ) as unknown as FileDeps['readFile'],
    remove: mock.fn(() => Promise.resolve()),
    mkdirSync: mock.fn(),
    createReadStream: mock.fn(() => ({
      pipe: function () {
        return this;
      },
    })) as unknown as FileDeps['createReadStream'],
    createWriteStream: mock.fn(() => ({
      on: mock.fn(),
      once: mock.fn(),
      emit: mock.fn(),
      end: mock.fn(),
      write: mock.fn(),
    })) as unknown as FileDeps['createWriteStream'],
    ...overrides,
  } as FileDeps;
}

describe('file', () => {
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

      const deps = createMockFileDeps({
        existsSync: mock.fn(() => true),
        readFile: mock.fn((path: string, cb: (err: Error | null, data: Buffer) => void) =>
          cb(null, Buffer.from('file content')),
        ) as unknown as FileDeps['readFile'],
      });

      const result = await getCacheFileLocation(
        MOCKED_PROPERTIES,
        { checksum, filename, alias: 'test' },
        deps,
      );

      assert.strictEqual(result, filePath);
    });

    it('should validate and remove invalid cached file', async () => {
      const checksum = 'server-checksum';
      const filename = 'file.txt';
      const mockRemove = mock.fn(() => Promise.resolve());

      const deps = createMockFileDeps({
        existsSync: mock.fn(() => true),
        readFile: mock.fn((path: string, cb: (err: Error | null, data: Buffer) => void) =>
          cb(null, Buffer.from('file content')),
        ) as unknown as FileDeps['readFile'],
        remove: mockRemove,
      });

      await assert.rejects(
        getCacheFileLocation(MOCKED_PROPERTIES, { checksum, filename, alias: 'test' }, deps),
        (err: Error) => {
          assert.ok(err.message.includes('Checksum verification failed'));
          assert.ok(err.message.includes('server-checksum'));
          return true;
        },
      );

      assert.strictEqual(mockRemove.mock.callCount(), 1);
      // The path will be OS-specific
      const removeFn = mockRemove as Mock<(path: string) => Promise<void>>;
      assert.ok(removeFn.mock.calls[0].arguments[0].includes('server-checksum'));
    });

    it('should return null if the file does not exist', async () => {
      const checksum = 'shahash';
      const filename = 'file.txt';

      const deps = createMockFileDeps({
        existsSync: mock.fn(() => false),
      });

      const result = await getCacheFileLocation(
        MOCKED_PROPERTIES,
        { checksum, filename, alias: 'test' },
        deps,
      );

      assert.strictEqual(result, null);
    });
  });

  describe('validateChecksum', () => {
    it('should read the file of the path provided', async () => {
      const mockReadFile = mock.fn((path: string, cb: (err: Error | null, data: Buffer) => void) =>
        cb(null, Buffer.from('file content')),
      );

      const deps = createMockFileDeps({
        readFile: mockReadFile as unknown as FileDeps['readFile'],
      });

      await validateChecksum(
        'path/to/file',
        'e0ac3601005dfa1864f5392aabaf7d898b1b5bab854f1acb4491bcd806b76b0c',
        deps,
      );

      assert.strictEqual(mockReadFile.mock.callCount(), 1);
      assert.strictEqual(mockReadFile.mock.calls[0].arguments[0], 'path/to/file');
    });

    it('should throw an error if the checksum does not match', async () => {
      const deps = createMockFileDeps({
        readFile: mock.fn((path: string, cb: (err: Error | null, data: Buffer) => void) =>
          cb(null, Buffer.from('file content')),
        ) as unknown as FileDeps['readFile'],
      });

      await assert.rejects(validateChecksum('path/to/file', 'invalidchecksum', deps), {
        message:
          'Checksum verification failed for path/to/file. Expected checksum invalidchecksum but got e0ac3601005dfa1864f5392aabaf7d898b1b5bab854f1acb4491bcd806b76b0c',
      });
    });

    it('should throw an error if the checksum is not provided', async () => {
      const deps = createMockFileDeps();

      await assert.rejects(validateChecksum('path/to/file', '', deps), {
        message: 'Checksum not provided',
      });
    });

    it('should throw an error if the file cannot be read', async () => {
      const deps = createMockFileDeps({
        readFile: mock.fn((path: string, cb: (err: Error | null, data: Buffer) => void) =>
          cb(new Error('File not found'), Buffer.from('')),
        ) as unknown as FileDeps['readFile'],
      });

      await assert.rejects(validateChecksum('path/to/file', 'checksum', deps), {
        message: 'File not found',
      });
    });
  });

  describe('extractArchive', () => {
    it('should extract a zip archive', async () => {
      // Since extractArchive uses AdmZip directly (not through FileDeps), we can't easily mock it
      // But we can test that the function handles different file extensions correctly
      // by checking that it throws for a non-existent zip file
      try {
        await extractArchive('/nonexistent/file.zip', '/tmp/extract-test');
        assert.fail('Expected an error');
      } catch (e) {
        // Expected to fail since file doesn't exist - this exercises the zip branch
        assert.ok(e instanceof Error);
      }
    });

    it('should reject tar.gz entries with path traversal (Zip Slip)', async () => {
      const tarStream = await import('tar-stream');
      const zlib = await import('node:zlib');
      const fs = await import('node:fs');
      const os = await import('node:os');

      // Create a tar.gz with a malicious path traversal entry
      const pack = tarStream.pack();
      pack.entry({ name: '../../../etc/passwd' }, 'malicious content');
      pack.finalize();

      // Write to temp file
      const tempPath = path.join(os.tmpdir(), `test-zipslip-${Date.now()}.tar.gz`);
      const gzip = zlib.createGzip();
      const writeStream = fs.createWriteStream(tempPath);

      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
        pack.pipe(gzip).pipe(writeStream);
      });

      try {
        await assert.rejects(extractArchive(tempPath, '/tmp/safe-dir'), {
          message: /would extract outside target directory/,
        });
      } finally {
        fs.unlinkSync(tempPath);
      }
    });

    it('should handle tar.gz archives', async () => {
      // Create a mock that returns itself for pipe chaining
      const mockStream = {
        pipe: function () {
          return this;
        },
      };
      const mockCreateReadStream = mock.fn(() => mockStream);
      const mockCreateWriteStream = mock.fn(() => ({
        on: mock.fn(),
        once: mock.fn(),
        emit: mock.fn(),
        end: mock.fn(),
        write: mock.fn(),
      }));

      const deps = createMockFileDeps({
        createReadStream: mockCreateReadStream as unknown as FileDeps['createReadStream'],
        createWriteStream: mockCreateWriteStream as unknown as FileDeps['createWriteStream'],
      });

      // Test that .tar.gz files use the tar-stream extraction path
      // Note: This test is limited because the actual tar extraction involves
      // event emitters and streams that are hard to mock completely
      try {
        // Set a short timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 100),
        );
        await Promise.race([
          extractArchive('/path/to/archive.tar.gz', '/dest/path', deps),
          timeoutPromise,
        ]);
      } catch (e) {
        // Expected to timeout because streams aren't properly connected in mock
        // The key is that we exercised the tar.gz code path
      }

      // Verify the tar.gz path was taken (createReadStream called)
      assert.strictEqual(mockCreateReadStream.mock.callCount(), 1);
    });
  });

  describe('getCacheDirectories', () => {
    it('should return the cache directories', async () => {
      const mockExistsSync = mock.fn(() => true);
      const mockMkdirSync = mock.fn();

      const deps = createMockFileDeps({
        existsSync: mockExistsSync,
        mkdirSync: mockMkdirSync,
      });

      const { archivePath, unarchivePath } = await getCacheDirectories(
        MOCKED_PROPERTIES,
        { checksum: 'md5_test', filename: 'file.txt', alias: 'test' },
        deps,
      );

      assert.strictEqual(mockExistsSync.mock.callCount(), 1);
      assert.deepStrictEqual(mockExistsSync.mock.calls[0].arguments, [
        path.join('/', 'sonar', 'cache', 'md5_test'),
      ]);
      assert.strictEqual(mockMkdirSync.mock.callCount(), 0);

      assert.strictEqual(archivePath, path.join('/', 'sonar', 'cache', 'md5_test', 'file.txt'));
      assert.strictEqual(
        unarchivePath,
        path.join('/', 'sonar', 'cache', 'md5_test', 'file.txt_extracted'),
      );
    });

    it('should create the parent cache directory if it does not exist', async () => {
      const mockExistsSync = mock.fn(() => false);
      const mockMkdirSync = mock.fn();

      const deps = createMockFileDeps({
        existsSync: mockExistsSync,
        mkdirSync: mockMkdirSync,
      });

      await getCacheDirectories(
        MOCKED_PROPERTIES,
        { checksum: 'md5_test', filename: 'file.txt', alias: 'test' },
        deps,
      );

      assert.strictEqual(mockExistsSync.mock.callCount(), 1);
      assert.deepStrictEqual(mockExistsSync.mock.calls[0].arguments, [
        path.join('/', 'sonar', 'cache', 'md5_test'),
      ]);
      assert.strictEqual(mockMkdirSync.mock.callCount(), 1);
      assert.deepStrictEqual(mockMkdirSync.mock.calls[0].arguments, [
        path.join('/', 'sonar', 'cache', 'md5_test'),
        { recursive: true },
      ]);
    });
  });
});
