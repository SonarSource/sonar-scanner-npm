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
import { EventEmitter } from 'node:events';
import { SCANNER_CLI_INSTALL_PATH, SCANNER_CLI_VERSION } from '../../src/constants';
import {
  type ScannerCliFsDeps,
  type ScannerCliProcessDeps,
  downloadScannerCli,
  normalizePlatformName,
  runScannerCli,
} from '../../src/scanner-cli';
import { ScannerProperty } from '../../src/types';

// Mock console.log to suppress output
mock.method(console, 'log', () => {});

const MOCK_PROPERTIES = {
  [ScannerProperty.SonarToken]: 'token',
  [ScannerProperty.SonarHostUrl]: 'http://localhost:9000',
  [ScannerProperty.SonarUserHome]: 'path/to/user/home',
  [ScannerProperty.SonarScannerCliVersion]: SCANNER_CLI_VERSION,
};

const SCANNER_CLI_VERSION_NO_ARCH = '6.0.0';
const MOCK_PROPERTIES_NO_ARCH = {
  [ScannerProperty.SonarToken]: 'token',
  [ScannerProperty.SonarHostUrl]: 'http://localhost:9000',
  [ScannerProperty.SonarUserHome]: 'path/to/user/home',
  [ScannerProperty.SonarScannerCliVersion]: SCANNER_CLI_VERSION_NO_ARCH,
};

function createMockProcessDeps(
  overrides: Partial<ScannerCliProcessDeps> = {},
): ScannerCliProcessDeps {
  return {
    platform: 'linux',
    arch: 'x64',
    env: {},
    ...overrides,
  };
}

function createMockFsDeps(overrides: Partial<ScannerCliFsDeps> = {}): ScannerCliFsDeps {
  return {
    exists: mock.fn(() => Promise.resolve(false)),
    ensureDir: mock.fn(() => Promise.resolve()),
    ...overrides,
  };
}

function createMockChildProcess() {
  const childProcess = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    stdin: { write: ReturnType<typeof mock.fn>; end: ReturnType<typeof mock.fn> };
  };
  childProcess.stdout = new EventEmitter();
  childProcess.stderr = new EventEmitter();
  childProcess.stdin = {
    write: mock.fn(),
    end: mock.fn(),
  };
  return childProcess;
}

describe('scanner-cli', () => {
  describe('downloadScannerCli', function () {
    it('should reject invalid versions', async () => {
      await assert.rejects(
        downloadScannerCli({
          [ScannerProperty.SonarScannerCliVersion]: 'not a version',
        }),
      );
    });

    it('should use already downloaded version', async () => {
      const scannerBinPath = path.join(
        MOCK_PROPERTIES[ScannerProperty.SonarUserHome],
        SCANNER_CLI_INSTALL_PATH,
        `sonar-scanner-${SCANNER_CLI_VERSION}-linux-x64/bin/sonar-scanner`,
      );
      const processDeps = createMockProcessDeps({ platform: 'linux' });
      const mockDownload = mock.fn(() => Promise.resolve());

      const fsDeps = createMockFsDeps({
        exists: mock.fn(() => Promise.resolve(true)),
      });

      const result = await downloadScannerCli(MOCK_PROPERTIES, {
        processDeps,
        fsDeps,
        downloadFn: mockDownload,
      });

      assert.strictEqual(result, scannerBinPath);
      assert.strictEqual(mockDownload.mock.callCount(), 0);
    });

    it('should use already downloaded version without arch', async () => {
      const scannerBinPath = path.join(
        MOCK_PROPERTIES_NO_ARCH[ScannerProperty.SonarUserHome],
        SCANNER_CLI_INSTALL_PATH,
        `sonar-scanner-${SCANNER_CLI_VERSION_NO_ARCH}-linux/bin/sonar-scanner`,
      );
      const processDeps = createMockProcessDeps({ platform: 'linux' });
      const mockDownload = mock.fn(() => Promise.resolve());

      const fsDeps = createMockFsDeps({
        exists: mock.fn(() => Promise.resolve(true)),
      });

      const result = await downloadScannerCli(MOCK_PROPERTIES_NO_ARCH, {
        processDeps,
        fsDeps,
        downloadFn: mockDownload,
      });

      assert.strictEqual(result, scannerBinPath);
      assert.strictEqual(mockDownload.mock.callCount(), 0);
    });

    it('should download SonarScanner CLI if it does not exist on Unix', async () => {
      const processDeps = createMockProcessDeps({ platform: 'linux' });
      const mockDownload = mock.fn(() => Promise.resolve());
      const mockExtractArchive = mock.fn(() => Promise.resolve());
      const mockEnsureDir = mock.fn(() => Promise.resolve());

      const fsDeps = createMockFsDeps({
        exists: mock.fn(() => Promise.resolve(false)),
        ensureDir: mockEnsureDir,
      });

      const binPath = await downloadScannerCli(MOCK_PROPERTIES, {
        processDeps,
        fsDeps,
        downloadFn: mockDownload,
        extractArchiveFn: mockExtractArchive,
      });

      assert.strictEqual(
        binPath,
        path.join(
          MOCK_PROPERTIES[ScannerProperty.SonarUserHome],
          SCANNER_CLI_INSTALL_PATH,
          `sonar-scanner-${SCANNER_CLI_VERSION}-linux-x64/bin/sonar-scanner`,
        ),
      );
      assert.strictEqual(mockDownload.mock.callCount(), 1);
      assert.deepStrictEqual(mockDownload.mock.calls[0].arguments, [
        `https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-${SCANNER_CLI_VERSION}-linux-x64.zip`,
        path.join(
          MOCK_PROPERTIES[ScannerProperty.SonarUserHome],
          SCANNER_CLI_INSTALL_PATH,
          `sonar-scanner-${SCANNER_CLI_VERSION}-linux-x64.zip`,
        ),
        undefined,
      ]);
      assert.strictEqual(mockExtractArchive.mock.callCount(), 1);
      assert.deepStrictEqual(mockExtractArchive.mock.calls[0].arguments, [
        path.join(
          MOCK_PROPERTIES[ScannerProperty.SonarUserHome],
          SCANNER_CLI_INSTALL_PATH,
          `sonar-scanner-${SCANNER_CLI_VERSION}-linux-x64.zip`,
        ),
        path.join(MOCK_PROPERTIES[ScannerProperty.SonarUserHome], SCANNER_CLI_INSTALL_PATH),
      ]);
    });

    it('should download SonarScanner CLI if it does not exist on Unix without arch', async () => {
      const processDeps = createMockProcessDeps({ platform: 'linux' });
      const mockDownload = mock.fn(() => Promise.resolve());
      const mockExtractArchive = mock.fn(() => Promise.resolve());

      const fsDeps = createMockFsDeps({
        exists: mock.fn(() => Promise.resolve(false)),
      });

      const binPath = await downloadScannerCli(MOCK_PROPERTIES_NO_ARCH, {
        processDeps,
        fsDeps,
        downloadFn: mockDownload,
        extractArchiveFn: mockExtractArchive,
      });

      assert.strictEqual(
        binPath,
        path.join(
          MOCK_PROPERTIES_NO_ARCH[ScannerProperty.SonarUserHome],
          SCANNER_CLI_INSTALL_PATH,
          `sonar-scanner-${SCANNER_CLI_VERSION_NO_ARCH}-linux/bin/sonar-scanner`,
        ),
      );
      assert.strictEqual(mockDownload.mock.callCount(), 1);
      assert.deepStrictEqual(mockDownload.mock.calls[0].arguments, [
        `https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-${SCANNER_CLI_VERSION_NO_ARCH}-linux.zip`,
        path.join(
          MOCK_PROPERTIES_NO_ARCH[ScannerProperty.SonarUserHome],
          SCANNER_CLI_INSTALL_PATH,
          `sonar-scanner-${SCANNER_CLI_VERSION_NO_ARCH}-linux.zip`,
        ),
        undefined,
      ]);
      assert.strictEqual(mockExtractArchive.mock.callCount(), 1);
    });

    it('should download SonarScanner CLI if it does not exist on Windows', async () => {
      const processDeps = createMockProcessDeps({ platform: 'win32' });
      const mockDownload = mock.fn(() => Promise.resolve());
      const mockExtractArchive = mock.fn(() => Promise.resolve());

      const fsDeps = createMockFsDeps({
        exists: mock.fn(() => Promise.resolve(false)),
      });

      const binPath = await downloadScannerCli(MOCK_PROPERTIES, {
        processDeps,
        fsDeps,
        downloadFn: mockDownload,
        extractArchiveFn: mockExtractArchive,
      });

      assert.strictEqual(mockDownload.mock.callCount(), 1);
      assert.deepStrictEqual(mockDownload.mock.calls[0].arguments, [
        `https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-${SCANNER_CLI_VERSION}-windows-x64.zip`,
        path.join(
          MOCK_PROPERTIES[ScannerProperty.SonarUserHome],
          SCANNER_CLI_INSTALL_PATH,
          `sonar-scanner-${SCANNER_CLI_VERSION}-windows-x64.zip`,
        ),
        undefined,
      ]);
      assert.strictEqual(mockExtractArchive.mock.callCount(), 1);
      assert.strictEqual(
        binPath,
        path.join(
          MOCK_PROPERTIES[ScannerProperty.SonarUserHome],
          SCANNER_CLI_INSTALL_PATH,
          `sonar-scanner-${SCANNER_CLI_VERSION}-windows-x64/bin/sonar-scanner.bat`,
        ),
      );
    });

    it('should persist username and password for scanner-cli download when a mirror is used', async () => {
      const processDeps = createMockProcessDeps({ platform: 'win32' });
      const mockDownload = mock.fn(() => Promise.resolve());
      const mockExtractArchive = mock.fn(() => Promise.resolve());

      const fsDeps = createMockFsDeps({
        exists: mock.fn(() => Promise.resolve(false)),
      });

      await downloadScannerCli(
        {
          ...MOCK_PROPERTIES,
          [ScannerProperty.SonarScannerCliMirror]: 'https://myUser:myPassword@mirror.com:80',
        },
        {
          processDeps,
          fsDeps,
          downloadFn: mockDownload,
          extractArchiveFn: mockExtractArchive,
        },
      );

      assert.strictEqual(mockDownload.mock.callCount(), 1);
      assert.deepStrictEqual(mockDownload.mock.calls[0].arguments, [
        `https://myUser:myPassword@mirror.com:80/sonar-scanner-cli-${SCANNER_CLI_VERSION}-windows-x64.zip`,
        path.join(
          MOCK_PROPERTIES[ScannerProperty.SonarUserHome],
          SCANNER_CLI_INSTALL_PATH,
          `sonar-scanner-${SCANNER_CLI_VERSION}-windows-x64.zip`,
        ),
        { headers: { Authorization: 'Basic bXlVc2VyOm15UGFzc3dvcmQ=' } },
      ]);
    });
  });

  describe('runScannerCli', function () {
    it('should pass jvmOptions and scanner properties to scanner', async () => {
      const mockChildProcess = createMockChildProcess();
      const mockSpawn = mock.fn(() => mockChildProcess);
      const processDeps = createMockProcessDeps({ platform: 'linux' });

      const promise = runScannerCli(
        { jvmOptions: ['-Xmx512m'] },
        MOCK_PROPERTIES,
        'sonar-scanner',
        {
          processDeps,
          spawnFn: mockSpawn as any,
        },
      );

      // Simulate process exit
      setTimeout(() => mockChildProcess.emit('exit', 0), 10);
      await promise;

      assert.strictEqual(mockSpawn.mock.callCount(), 1);
      type SpawnFnType = (cmd: string, ...rest: unknown[]) => unknown;
      assert.strictEqual(
        (mockSpawn as Mock<SpawnFnType>).mock.calls[0].arguments[0],
        'sonar-scanner',
      );
    });

    it('should reject if SonarScanner CLI fails', async () => {
      const mockChildProcess = createMockChildProcess();
      const mockSpawn = mock.fn(() => mockChildProcess);
      const processDeps = createMockProcessDeps({ platform: 'linux' });

      const promise = runScannerCli({}, MOCK_PROPERTIES, 'sonar-scanner', {
        processDeps,
        spawnFn: mockSpawn as any,
      });

      // Simulate process exit with error
      setTimeout(() => mockChildProcess.emit('exit', 1), 10);

      await assert.rejects(promise, {
        message: 'SonarScanner CLI failed with code 1',
      });
    });

    it('should display SonarScanner CLI output', async () => {
      const mockChildProcess = createMockChildProcess();
      const mockSpawn = mock.fn(() => mockChildProcess);
      const processDeps = createMockProcessDeps({ platform: 'linux' });
      const stdoutWritten: string[] = [];
      const originalWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = ((chunk: string | Buffer) => {
        stdoutWritten.push(chunk.toString());
        return true;
      }) as typeof process.stdout.write;

      const promise = runScannerCli({}, MOCK_PROPERTIES, 'sonar-scanner', {
        processDeps,
        spawnFn: mockSpawn as any,
      });

      // Simulate output and exit
      setTimeout(() => {
        mockChildProcess.stdout.emit('data', Buffer.from('scanner output'));
        mockChildProcess.stderr.emit('data', Buffer.from('scanner error'));
        mockChildProcess.emit('exit', 0);
      }, 10);

      await promise;
      process.stdout.write = originalWrite;

      assert.ok(stdoutWritten.some(s => s.includes('scanner output')));
    });

    it('should only forward non-scanner env vars to Scanner CLI', async () => {
      const mockChildProcess = createMockChildProcess();
      type SpawnFn = (
        cmd: string,
        args: string[],
        options: { env: Record<string, string>; shell: boolean },
      ) => typeof mockChildProcess;
      const mockSpawn = mock.fn<SpawnFn>(() => mockChildProcess);
      const processDeps = createMockProcessDeps({
        platform: 'linux',
        env: {
          SONAR_TOKEN: 'sqa_sometoken',
          SONAR_SCANNER_SOME_VAR: 'some_value',
          CIRRUS_CI_SOME_VAR: 'some_value',
        },
      });

      const promise = runScannerCli({}, MOCK_PROPERTIES, 'sonar-scanner', {
        processDeps,
        spawnFn: mockSpawn as any,
      });

      // Simulate process exit
      setTimeout(() => mockChildProcess.emit('exit', 0), 10);
      await promise;

      assert.strictEqual(mockSpawn.mock.callCount(), 1);
      const options = mockSpawn.mock.calls[0].arguments[2];
      // SONAR_TOKEN and SONAR_SCANNER_SOME_VAR should be filtered out
      assert.strictEqual(options.env.SONAR_TOKEN, undefined);
      assert.strictEqual(options.env.SONAR_SCANNER_SOME_VAR, undefined);
      // CIRRUS_CI_SOME_VAR should be passed through
      assert.strictEqual(options.env.CIRRUS_CI_SOME_VAR, 'some_value');
      // SONARQUBE_SCANNER_PARAMS should be set
      assert.strictEqual(options.env.SONARQUBE_SCANNER_PARAMS, JSON.stringify(MOCK_PROPERTIES));
    });

    it('should pass proxy options to scanner', async () => {
      const mockChildProcess = createMockChildProcess();
      type SpawnFn = (cmd: string, args: string[], options: unknown) => typeof mockChildProcess;
      const mockSpawn = mock.fn<SpawnFn>(() => mockChildProcess);
      const processDeps = createMockProcessDeps({ platform: 'linux' });
      const propertiesWithProxy = {
        ...MOCK_PROPERTIES,
        [ScannerProperty.SonarScannerProxyHost]: 'proxy',
        [ScannerProperty.SonarScannerProxyPort]: '9000',
        [ScannerProperty.SonarScannerProxyUser]: 'some-user',
        [ScannerProperty.SonarScannerProxyPassword]: 'password',
      };

      const promise = runScannerCli({}, propertiesWithProxy, 'sonar-scanner', {
        processDeps,
        spawnFn: mockSpawn as any,
      });

      // Simulate process exit
      setTimeout(() => mockChildProcess.emit('exit', 0), 10);
      await promise;

      assert.strictEqual(mockSpawn.mock.callCount(), 1);
      assert.strictEqual(mockSpawn.mock.calls[0].arguments[0], 'sonar-scanner');
      assert.deepStrictEqual(mockSpawn.mock.calls[0].arguments[1], [
        '-Dhttp.proxyHost=proxy',
        '-Dhttp.proxyPort=9000',
        '-Dhttp.proxyUser=some-user',
        '-Dhttp.proxyPassword=password',
      ]);
    });

    it('should pass https proxy options to scanner', async () => {
      const mockChildProcess = createMockChildProcess();
      type SpawnFn = (cmd: string, args: string[], options: unknown) => typeof mockChildProcess;
      const mockSpawn = mock.fn<SpawnFn>(() => mockChildProcess);
      const processDeps = createMockProcessDeps({ platform: 'linux' });
      const propertiesWithHttpsProxy = {
        [ScannerProperty.SonarToken]: 'token',
        [ScannerProperty.SonarHostUrl]: 'https://localhost:9000',
        [ScannerProperty.SonarScannerProxyHost]: 'proxy',
        [ScannerProperty.SonarScannerProxyPort]: '9000',
        [ScannerProperty.SonarScannerProxyUser]: 'some-user',
        [ScannerProperty.SonarScannerProxyPassword]: 'password',
      };

      const promise = runScannerCli({}, propertiesWithHttpsProxy, 'sonar-scanner', {
        processDeps,
        spawnFn: mockSpawn as any,
      });

      // Simulate process exit
      setTimeout(() => mockChildProcess.emit('exit', 0), 10);
      await promise;

      assert.strictEqual(mockSpawn.mock.callCount(), 1);
      assert.strictEqual(mockSpawn.mock.calls[0].arguments[0], 'sonar-scanner');
      assert.deepStrictEqual(mockSpawn.mock.calls[0].arguments[1], [
        '-Dhttps.proxyHost=proxy',
        '-Dhttps.proxyPort=9000',
        '-Dhttps.proxyUser=some-user',
        '-Dhttps.proxyPassword=password',
      ]);
    });
  });

  describe('normalizePlatformName', function () {
    it('detect Windows', function () {
      const processDeps = createMockProcessDeps({ platform: 'win32' });
      assert.strictEqual(normalizePlatformName(processDeps), 'windows');
    });

    it('detect Mac', function () {
      const processDeps = createMockProcessDeps({ platform: 'darwin' });
      assert.strictEqual(normalizePlatformName(processDeps), 'macosx');
    });

    it('detect Linux', function () {
      const processDeps = createMockProcessDeps({ platform: 'linux' });
      assert.strictEqual(normalizePlatformName(processDeps), 'linux');
    });

    it('throw if something else', function () {
      const processDeps = createMockProcessDeps({ platform: 'non-existing-os' as NodeJS.Platform });
      assert.throws(() => normalizePlatformName(processDeps), {
        message: `Your platform 'non-existing-os' is currently not supported.`,
      });
    });
  });
});
