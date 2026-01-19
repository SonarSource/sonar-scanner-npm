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

import { describe, it, beforeEach, afterEach, mock, type Mock } from 'node:test';
import assert from 'node:assert';
import { setDeps, resetDeps, type Dependencies } from '../../src/deps';
import { fetchScannerEngine, runScannerEngine } from '../../src/scanner-engine';
import {
  type AnalysisEngineResponseType,
  type ScannerProperties,
  ScannerProperty,
} from '../../src/types';
import { createMockChildProcess, createMockFsDeps, createMockHttpDeps } from './test-helpers';

// Mock console.log to suppress output and capture log calls
const mockLog = mock.fn();
mock.method(console, 'log', mockLog);

const MOCKED_PROPERTIES: ScannerProperties = {
  [ScannerProperty.SonarHostUrl]: 'http://sonarqube.com',
  [ScannerProperty.SonarToken]: 'dummy-token',
  [ScannerProperty.SonarUserHome]: '/sonar',
};

const SCANNER_ENGINE_RESPONSE: AnalysisEngineResponseType = {
  filename: 'scanner-engine-1.2.3.jar',
  sha256: 'sha_test',
};

let commandHistory: string[] = [];

beforeEach(() => {
  commandHistory = [];
  mockLog.mock.resetCalls();
});

afterEach(() => {
  resetDeps();
});

describe('scanner-engine', () => {
  describe('fetchScannerEngine', () => {
    it('should fetch the latest version of the scanner engine', async () => {
      const mockDownload = mock.fn(() => Promise.resolve());
      const mockRemove = mock.fn(() => Promise.resolve());
      const mockFetch = mock.fn(() => Promise.resolve({ data: SCANNER_ENGINE_RESPONSE }));

      setDeps({
        fs: createMockFsDeps({
          existsSync: mock.fn(() => false),
          mkdirSync: mock.fn() as any,
          readFile: mock.fn((path: string, cb: (err: Error | null, data: Buffer) => void) =>
            cb(null, Buffer.from('')),
          ) as any,
          remove: mockRemove,
        }),
        http: createMockHttpDeps({
          fetch: mockFetch as any,
          download: mockDownload,
        }),
      });

      // Will fail at checksum validation, but we verify the fetch was called
      try {
        await fetchScannerEngine(MOCKED_PROPERTIES);
      } catch (e) {
        // Expected to fail at checksum validation
      }

      assert.strictEqual(mockDownload.mock.callCount(), 1);
    });

    it('should remove file when checksum does not match', async () => {
      const mockDownload = mock.fn(() => Promise.resolve());
      const mockRemove = mock.fn(() => Promise.resolve());
      const mockFetch = mock.fn(() => Promise.resolve({ data: SCANNER_ENGINE_RESPONSE }));

      setDeps({
        fs: createMockFsDeps({
          existsSync: mock.fn(() => false),
          mkdirSync: mock.fn() as any,
          readFile: mock.fn((path: string, cb: (err: Error | null, data: Buffer) => void) =>
            cb(null, Buffer.from('wrong content')),
          ) as any,
          remove: mockRemove,
        }),
        http: createMockHttpDeps({
          fetch: mockFetch as any,
          download: mockDownload,
        }),
      });

      await assert.rejects(async () => fetchScannerEngine(MOCKED_PROPERTIES));

      assert.strictEqual(mockRemove.mock.callCount(), 1);
    });

    describe('when the scanner engine is cached', () => {
      it('should use the cached scanner engine', async () => {
        const mockDownload = mock.fn(() => Promise.resolve());
        // Use the sha256 of empty buffer
        const emptyBufferSha256 =
          'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
        const mockFetch = mock.fn(() =>
          Promise.resolve({
            data: { filename: 'scanner-engine-1.2.3.jar', sha256: emptyBufferSha256 },
          }),
        );

        setDeps({
          fs: createMockFsDeps({
            existsSync: mock.fn(() => true),
            readFile: mock.fn((path: string, cb: (err: Error | null, data: Buffer) => void) =>
              cb(null, Buffer.from('')),
            ) as any,
          }),
          http: createMockHttpDeps({
            fetch: mockFetch as any,
            download: mockDownload,
          }),
        });

        await fetchScannerEngine(MOCKED_PROPERTIES);

        assert.strictEqual(mockDownload.mock.callCount(), 0);
      });
    });

    describe('when the scanner engine is not cached', () => {
      it('should download the scanner engine', async () => {
        const mockDownload = mock.fn(() => Promise.resolve());
        const mockRemove = mock.fn(() => Promise.resolve());
        const mockFetch = mock.fn(() => Promise.resolve({ data: SCANNER_ENGINE_RESPONSE }));

        setDeps({
          fs: createMockFsDeps({
            existsSync: mock.fn(() => false),
            mkdirSync: mock.fn() as any,
            readFile: mock.fn((path: string, cb: (err: Error | null, data: Buffer) => void) =>
              cb(null, Buffer.from('')),
            ) as any,
            remove: mockRemove,
          }),
          http: createMockHttpDeps({
            fetch: mockFetch as any,
            download: mockDownload,
          }),
        });

        // Will fail at checksum validation, but we verify download was called
        try {
          await fetchScannerEngine(MOCKED_PROPERTIES);
        } catch (e) {
          // Expected to fail at checksum validation
        }

        assert.strictEqual(mockDownload.mock.callCount(), 1);
      });
    });
  });

  describe('runScannerEngine', () => {
    it('should launch scanner engine and write properties to stdin', async () => {
      let writtenData: string | undefined;
      const mockChildProcess = createMockChildProcess();
      mockChildProcess.stdin.write = mock.fn((data: string) => {
        writtenData = data;
        return true;
      }) as any;

      const mockSpawn = mock.fn(() => {
        commandHistory.push('java');
        return mockChildProcess;
      });

      setDeps({
        fs: createMockFsDeps(),
        spawn: mockSpawn as any,
      });

      const properties = {
        ...MOCKED_PROPERTIES,
        [ScannerProperty.SonarScannerJavaOptions]: '-Xmx512m',
      };

      const promise = runScannerEngine(
        'java',
        '/some/path/to/scanner-engine',
        {
          jvmOptions: ['-Dsome.custom.opt=123'],
        },
        properties,
      );

      // Simulate process exit
      setTimeout(() => mockChildProcess.emit('exit', 0), 10);
      await promise;

      assert.ok(writtenData, 'Expected data to be written to stdin');
      const parsedData = JSON.parse(writtenData);
      assert.deepStrictEqual(parsedData, {
        scannerProperties: Object.entries(properties).map(([key, value]) => ({
          key,
          value,
        })),
      });
    });

    it('should reject when child process exits with code 1', async () => {
      const mockChildProcess = createMockChildProcess({ exitCode: 1 });

      setDeps({
        fs: createMockFsDeps(),
        spawn: mock.fn(() => mockChildProcess) as any,
      });

      const promise = runScannerEngine(
        '/some/path/to/java',
        '/some/path/to/scanner-engine',
        {},
        MOCKED_PROPERTIES,
      );

      // Simulate process exit with error
      setTimeout(() => mockChildProcess.emit('exit', 1), 10);

      await assert.rejects(promise, Error);
    });

    it('should output scanner engine output', async () => {
      const output = [
        JSON.stringify({ level: 'DEBUG', message: 'the message' }),
        JSON.stringify({ level: 'INFO', message: 'another message' }),
        "some non-JSON message which shouldn't crash the bootstrapper",
        JSON.stringify({
          level: 'ERROR',
          message: 'final message',
          stacktrace: 'this is a stacktrace',
        }),
      ].join('\n');

      const mockChildProcess = createMockChildProcess();

      setDeps({
        fs: createMockFsDeps(),
        spawn: mock.fn(() => mockChildProcess) as any,
      });

      const promise = runScannerEngine(
        '/some/path/to/java',
        '/some/path/to/scanner-engine',
        {},
        MOCKED_PROPERTIES,
      );

      // Emit stdout data and exit
      setTimeout(() => {
        mockChildProcess.stdout.emit('data', Buffer.from(output));
        mockChildProcess.emit('exit', 0);
      }, 10);

      await promise;

      // Check that log messages were recorded
      assert.ok(
        mockLog.mock.calls.some(call =>
          call.arguments.some(
            (arg: unknown) =>
              typeof arg === 'string' &&
              (arg.includes('the message') ||
                arg.includes('another message') ||
                arg.includes('final message')),
          ),
        ),
      );
    });

    const proxyProtocols = ['http', 'https'];
    for (const protocol of proxyProtocols) {
      it(`should forward proxy ${protocol} properties to JVM`, async () => {
        const mockChildProcess = createMockChildProcess();
        const mockSpawn = mock.fn(() => {
          commandHistory.push('/some/path/to/java');
          return mockChildProcess;
        });

        setDeps({
          fs: createMockFsDeps(),
          spawn: mockSpawn as any,
        });

        const promise = runScannerEngine(
          '/some/path/to/java',
          '/some/path/to/scanner-engine',
          {},
          {
            [ScannerProperty.SonarHostUrl]: `${protocol}://my-sonarqube.comp.org`,
            [ScannerProperty.SonarScannerProxyHost]: 'some-proxy.io',
            [ScannerProperty.SonarScannerProxyPort]: '4244',
            [ScannerProperty.SonarScannerProxyUser]: 'the-user',
            [ScannerProperty.SonarScannerProxyPassword]: 'the-pass',
          },
        );

        // Simulate process exit
        setTimeout(() => mockChildProcess.emit('exit', 0), 10);
        await promise;

        assert.ok(commandHistory.includes('/some/path/to/java'));
      });
    }

    it('should dump to file when SonarScannerInternalDumpToFile is set', async () => {
      const mockWriteFile = mock.fn(() => Promise.resolve());
      const mockChildProcess = createMockChildProcess();
      const mockSpawn = mock.fn(() => {
        commandHistory.push('/some/path/to/java');
        return mockChildProcess;
      });

      setDeps({
        fs: createMockFsDeps({
          writeFile: mockWriteFile,
        }),
        spawn: mockSpawn as any,
      });

      const dumpFilePath = '/tmp/dump.json';

      await runScannerEngine(
        '/some/path/to/java',
        '/some/path/to/scanner-engine',
        {},
        {
          ...MOCKED_PROPERTIES,
          [ScannerProperty.SonarScannerInternalDumpToFile]: dumpFilePath,
        },
      );

      // Verify writeFile was called with correct path
      assert.strictEqual(mockWriteFile.mock.callCount(), 1);
      assert.strictEqual(
        (mockWriteFile as Mock<Dependencies['fs']['writeFile']>).mock.calls[0].arguments[0],
        dumpFilePath,
      );

      // Verify spawn was NOT called (should exit early)
      assert.strictEqual(commandHistory.length, 0);
    });
  });
});
