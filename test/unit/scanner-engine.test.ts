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

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { ChildProcess, SpawnOptions } from 'node:child_process';
import { EventEmitter } from 'node:events';
import sinon from 'sinon';
import { API_V2_SCANNER_ENGINE_ENDPOINT, SONAR_SCANNER_ALIAS } from '../../src/constants';
import { SpawnFn } from '../../src/scanner-cli';
import * as request from '../../src/request';
import {
  fetchScannerEngine,
  runScannerEngine,
  ScannerEngineDeps,
  ScannerEngineFsDeps,
} from '../../src/scanner-engine';
import { AnalysisEngineResponseType, ScannerProperties, ScannerProperty } from '../../src/types';

// Mock console.log to suppress output and capture log calls
const mockLog = mock.fn();
mock.method(console, 'log', mockLog);

const axiosMock = new MockAdapter(axios);

const MOCKED_PROPERTIES: ScannerProperties = {
  [ScannerProperty.SonarHostUrl]: 'http://sonarqube.com',
  [ScannerProperty.SonarToken]: 'dummy-token',
};

const MOCK_CACHE_DIRECTORIES = {
  archivePath: 'mocked/path/to/sonar/cache/sha_test/scanner-engine-1.2.3.jar',
  unarchivePath: 'mocked/path/to/sonar/cache/sha_test/scanner-engine-1.2.3.jar_extracted',
};

// Mock functions for dependency injection
const mockGetCacheFileLocation = mock.fn(() => Promise.resolve(null));
const mockExtractArchive = mock.fn(() => Promise.resolve());
const mockValidateChecksum = mock.fn(() => Promise.resolve());
const mockGetCacheDirectories = mock.fn(() => Promise.resolve(MOCK_CACHE_DIRECTORIES));
const mockDownload = mock.fn(() => Promise.resolve());
const mockRemove = mock.fn(() => Promise.resolve());

function createMockFsDeps(): ScannerEngineFsDeps {
  return {
    remove: mockRemove,
    writeFile: mock.fn(() => Promise.resolve()),
  };
}

function createScannerEngineDeps(): ScannerEngineDeps {
  return {
    fsDeps: createMockFsDeps(),
    getCacheFileLocationFn: mockGetCacheFileLocation,
    getCacheDirectoriesFn: mockGetCacheDirectories,
    validateChecksumFn: mockValidateChecksum,
    extractArchiveFn: mockExtractArchive,
    downloadFn: mockDownload,
  };
}

// Create a mock child process for runScannerEngine tests
function createMockChildProcess(
  options: { exitCode?: number; stdout?: string; stderr?: string } = {},
) {
  const { exitCode = 0, stdout = '', stderr = '' } = options;

  const childProcess = new EventEmitter() as EventEmitter & {
    stdin: { write: ReturnType<typeof mock.fn>; end: ReturnType<typeof mock.fn> };
    stdout: EventEmitter;
    stderr: EventEmitter;
  };

  childProcess.stdin = {
    write: mock.fn(),
    end: mock.fn(),
  };
  childProcess.stdout = new EventEmitter();
  childProcess.stderr = new EventEmitter();

  // Schedule the exit event and stdout/stderr output
  setTimeout(() => {
    if (stdout) {
      childProcess.stdout.emit('data', Buffer.from(stdout));
    }
    if (stderr) {
      childProcess.stderr.emit('data', Buffer.from(stderr));
    }
    childProcess.emit('exit', exitCode);
  }, 10);

  return childProcess as unknown as ChildProcess;
}

let commandHistory: string[] = [];

function createMockSpawn(
  options: { exitCode?: number; stdout?: string; stderr?: string } = {},
): SpawnFn {
  return (command: string, args?: readonly string[], spawnOptions?: SpawnOptions) => {
    commandHistory.push(command);
    return createMockChildProcess(options);
  };
}

beforeEach(async () => {
  commandHistory = [];
  mockLog.mock.resetCalls();
  axiosMock.reset();

  // Reset mock functions
  mockGetCacheFileLocation.mock.resetCalls();
  mockGetCacheFileLocation.mock.mockImplementation(() => Promise.resolve(null));

  mockExtractArchive.mock.resetCalls();
  mockExtractArchive.mock.mockImplementation(() => Promise.resolve());

  mockValidateChecksum.mock.resetCalls();
  mockValidateChecksum.mock.mockImplementation(() => Promise.resolve());

  mockGetCacheDirectories.mock.resetCalls();
  mockGetCacheDirectories.mock.mockImplementation(() => Promise.resolve(MOCK_CACHE_DIRECTORIES));

  mockDownload.mock.resetCalls();
  mockDownload.mock.mockImplementation(() => Promise.resolve());

  mockRemove.mock.resetCalls();
  mockRemove.mock.mockImplementation(() => Promise.resolve());

  await request.initializeAxios(MOCKED_PROPERTIES);

  axiosMock.onGet(API_V2_SCANNER_ENGINE_ENDPOINT).reply(200, {
    filename: 'scanner-engine-1.2.3.jar',
    sha256: 'sha_test',
  } as AnalysisEngineResponseType);
});

describe('scanner-engine', () => {
  describe('fetchScannerEngine', () => {
    it('should fetch the latest version of the scanner engine', async () => {
      const deps = createScannerEngineDeps();
      await fetchScannerEngine(MOCKED_PROPERTIES, deps);

      assert.strictEqual(mockGetCacheFileLocation.mock.callCount(), 1);
      assert.deepStrictEqual(mockGetCacheFileLocation.mock.calls[0].arguments, [
        MOCKED_PROPERTIES,
        {
          checksum: 'sha_test',
          filename: 'scanner-engine-1.2.3.jar',
          alias: SONAR_SCANNER_ALIAS,
        },
      ]);
    });

    it('should remove file when checksum does not match', async () => {
      mockValidateChecksum.mock.mockImplementation(() =>
        Promise.reject(new Error('Checksum mismatch')),
      );
      const deps = createScannerEngineDeps();

      await assert.rejects(async () => fetchScannerEngine(MOCKED_PROPERTIES, deps));

      assert.strictEqual(mockRemove.mock.callCount(), 1);
      assert.deepStrictEqual(mockRemove.mock.calls[0].arguments, [
        'mocked/path/to/sonar/cache/sha_test/scanner-engine-1.2.3.jar',
      ]);
    });

    describe('when the scanner engine is cached', () => {
      it('should use the cached scanner engine', async () => {
        mockGetCacheFileLocation.mock.mockImplementation(() =>
          Promise.resolve('mocked/path/to/scanner-engine'),
        );

        const deps = createScannerEngineDeps();
        const scannerEngine = await fetchScannerEngine(MOCKED_PROPERTIES, deps);

        assert.strictEqual(mockGetCacheFileLocation.mock.callCount(), 1);
        assert.strictEqual(mockDownload.mock.callCount(), 0);
        assert.strictEqual(mockExtractArchive.mock.callCount(), 0);
        assert.strictEqual(scannerEngine, 'mocked/path/to/scanner-engine');
      });
    });

    describe('when the scanner engine is not cached', () => {
      it('should download and extract the scanner engine', async () => {
        const deps = createScannerEngineDeps();
        const scannerEngine = await fetchScannerEngine(MOCKED_PROPERTIES, deps);

        assert.strictEqual(mockGetCacheFileLocation.mock.callCount(), 1);
        assert.strictEqual(mockDownload.mock.callCount(), 1);
        assert.strictEqual(
          scannerEngine,
          'mocked/path/to/sonar/cache/sha_test/scanner-engine-1.2.3.jar',
        );
      });
    });
  });

  describe('runScannerEngine', () => {
    it('should launch scanner engine and write properties to stdin', async () => {
      let writtenData: string | undefined;
      const mockSpawn: SpawnFn = (command, args, options) => {
        commandHistory.push(command);
        const cp = createMockChildProcess();
        // Capture the data written to stdin
        const originalWrite = cp.stdin.write;
        cp.stdin.write = mock.fn((data: string) => {
          writtenData = data;
          return true;
        }) as any;
        return cp;
      };

      const properties = {
        ...MOCKED_PROPERTIES,
        [ScannerProperty.SonarScannerJavaOptions]: '-Xmx512m',
      };

      await runScannerEngine(
        'java',
        '/some/path/to/scanner-engine',
        {
          jvmOptions: ['-Dsome.custom.opt=123'],
        },
        properties,
        { spawnFn: mockSpawn },
      );

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
      const mockSpawn = createMockSpawn({ exitCode: 1 });

      await assert.rejects(
        runScannerEngine(
          '/some/path/to/java',
          '/some/path/to/scanner-engine',
          {},
          MOCKED_PROPERTIES,
          { spawnFn: mockSpawn },
        ),
        Error,
      );
    });

    it('should output scanner engine output', async () => {
      const stdoutStub = sinon.stub(process.stdout, 'write');

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

      const mockSpawn = createMockSpawn({ stdout: output });

      await runScannerEngine(
        '/some/path/to/java',
        '/some/path/to/scanner-engine',
        {},
        MOCKED_PROPERTIES,
        { spawnFn: mockSpawn },
      );

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

      stdoutStub.restore();
    });

    const proxyProtocols = ['http', 'https'];
    for (const protocol of proxyProtocols) {
      it(`should forward proxy ${protocol} properties to JVM`, async () => {
        const mockSpawn = createMockSpawn();

        await runScannerEngine(
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
          { spawnFn: mockSpawn },
        );

        assert.ok(commandHistory.includes('/some/path/to/java'));
      });
    }

    it('should dump to file when SonarScannerInternalDumpToFile is set', async () => {
      const mockWriteFile = mock.fn(() => Promise.resolve());
      const mockFsDeps: ScannerEngineFsDeps = {
        remove: mock.fn(() => Promise.resolve()),
        writeFile: mockWriteFile,
      };

      const mockSpawn = createMockSpawn();
      const dumpFilePath = '/tmp/dump.json';

      await runScannerEngine(
        '/some/path/to/java',
        '/some/path/to/scanner-engine',
        {},
        {
          ...MOCKED_PROPERTIES,
          [ScannerProperty.SonarScannerInternalDumpToFile]: dumpFilePath,
        },
        { spawnFn: mockSpawn, fsDeps: mockFsDeps },
      );

      // Verify writeFile was called with correct path
      assert.strictEqual(mockWriteFile.mock.callCount(), 1);
      assert.strictEqual(mockWriteFile.mock.calls[0].arguments[0], dumpFilePath);

      // Verify spawn was NOT called (should exit early)
      assert.strictEqual(commandHistory.length, 0);
    });
  });
});
