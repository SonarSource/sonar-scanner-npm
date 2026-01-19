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
import { describe, it, mock, afterEach, type Mock } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import type { SpawnFn } from '../../src/deps';
import type { download } from '../../src/request';
import { SCANNER_CLI_INSTALL_PATH, SCANNER_CLI_VERSION } from '../../src/constants';
import { setDeps, resetDeps } from '../../src/deps';
import { downloadScannerCli, normalizePlatformName, runScannerCli } from '../../src/scanner-cli';
import { ScannerProperty } from '../../src/types';
import {
  createMockChildProcess,
  createMockProcessDeps,
  createMockFsDeps,
  createMockHttpDeps,
  createMockFileDeps,
} from './test-helpers';

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

afterEach(() => {
  resetDeps();
});

describe('scanner-cli', () => {
  describe('downloadScannerCli', function () {
    it('should reject invalid versions', async () => {
      setDeps({
        process: createMockProcessDeps({ platform: 'linux' }),
      });

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
      const mockDownload = mock.fn(() => Promise.resolve());

      setDeps({
        process: createMockProcessDeps({ platform: 'linux' }),
        fs: createMockFsDeps({
          exists: mock.fn(() => Promise.resolve(true)),
        }),
        http: createMockHttpDeps({
          download: mockDownload,
        }),
      });

      const result = await downloadScannerCli(MOCK_PROPERTIES);

      assert.strictEqual(result, scannerBinPath);
      assert.strictEqual(mockDownload.mock.callCount(), 0);
    });

    it('should use already downloaded version without arch', async () => {
      const scannerBinPath = path.join(
        MOCK_PROPERTIES_NO_ARCH[ScannerProperty.SonarUserHome],
        SCANNER_CLI_INSTALL_PATH,
        `sonar-scanner-${SCANNER_CLI_VERSION_NO_ARCH}-linux/bin/sonar-scanner`,
      );
      const mockDownload = mock.fn(() => Promise.resolve());

      setDeps({
        process: createMockProcessDeps({ platform: 'linux' }),
        fs: createMockFsDeps({
          exists: mock.fn(() => Promise.resolve(true)),
        }),
        http: createMockHttpDeps({
          download: mockDownload,
        }),
      });

      const result = await downloadScannerCli(MOCK_PROPERTIES_NO_ARCH);

      assert.strictEqual(result, scannerBinPath);
      assert.strictEqual(mockDownload.mock.callCount(), 0);
    });

    it('should download SonarScanner CLI if it does not exist on Unix', async () => {
      const mockDownload = mock.fn(() => Promise.resolve());
      const mockEnsureDir = mock.fn(() => Promise.resolve());
      const mockExtractArchive = mock.fn(() => Promise.resolve());

      setDeps({
        process: createMockProcessDeps({ platform: 'linux' }),
        fs: createMockFsDeps({
          exists: mock.fn(() => Promise.resolve(false)),
          ensureDir: mockEnsureDir,
        }),
        http: createMockHttpDeps({
          download: mockDownload,
        }),
        file: createMockFileDeps({
          extractArchive: mockExtractArchive,
        }),
      });

      const binPath = await downloadScannerCli(MOCK_PROPERTIES);

      assert.strictEqual(
        binPath,
        path.join(
          MOCK_PROPERTIES[ScannerProperty.SonarUserHome],
          SCANNER_CLI_INSTALL_PATH,
          `sonar-scanner-${SCANNER_CLI_VERSION}-linux-x64/bin/sonar-scanner`,
        ),
      );
      assert.strictEqual(mockDownload.mock.callCount(), 1);
      assert.deepStrictEqual(
        (mockDownload as Mock<typeof download>).mock.calls[0].arguments[0],
        `https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-${SCANNER_CLI_VERSION}-linux-x64.zip`,
      );
    });

    it('should download SonarScanner CLI if it does not exist on Unix without arch', async () => {
      const mockDownload = mock.fn(() => Promise.resolve());
      const mockExtractArchive = mock.fn(() => Promise.resolve());

      setDeps({
        process: createMockProcessDeps({ platform: 'linux' }),
        fs: createMockFsDeps({
          exists: mock.fn(() => Promise.resolve(false)),
        }),
        http: createMockHttpDeps({
          download: mockDownload,
        }),
        file: createMockFileDeps({
          extractArchive: mockExtractArchive,
        }),
      });

      const binPath = await downloadScannerCli(MOCK_PROPERTIES_NO_ARCH);

      assert.strictEqual(
        binPath,
        path.join(
          MOCK_PROPERTIES_NO_ARCH[ScannerProperty.SonarUserHome],
          SCANNER_CLI_INSTALL_PATH,
          `sonar-scanner-${SCANNER_CLI_VERSION_NO_ARCH}-linux/bin/sonar-scanner`,
        ),
      );
      assert.strictEqual(mockDownload.mock.callCount(), 1);
      assert.deepStrictEqual(
        (mockDownload as Mock<typeof download>).mock.calls[0].arguments[0],
        `https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-${SCANNER_CLI_VERSION_NO_ARCH}-linux.zip`,
      );
    });

    it('should download SonarScanner CLI if it does not exist on Windows', async () => {
      const mockDownload = mock.fn(() => Promise.resolve());
      const mockExtractArchive = mock.fn(() => Promise.resolve());

      setDeps({
        process: createMockProcessDeps({ platform: 'win32' }),
        fs: createMockFsDeps({
          exists: mock.fn(() => Promise.resolve(false)),
        }),
        http: createMockHttpDeps({
          download: mockDownload,
        }),
        file: createMockFileDeps({
          extractArchive: mockExtractArchive,
        }),
      });

      const binPath = await downloadScannerCli(MOCK_PROPERTIES);

      assert.strictEqual(mockDownload.mock.callCount(), 1);
      assert.deepStrictEqual(
        (mockDownload as Mock<typeof download>).mock.calls[0].arguments[0],
        `https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-${SCANNER_CLI_VERSION}-windows-x64.zip`,
      );
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
      const mockDownload = mock.fn(() => Promise.resolve());
      const mockExtractArchive = mock.fn(() => Promise.resolve());

      setDeps({
        process: createMockProcessDeps({ platform: 'win32' }),
        fs: createMockFsDeps({
          exists: mock.fn(() => Promise.resolve(false)),
        }),
        http: createMockHttpDeps({
          download: mockDownload,
        }),
        file: createMockFileDeps({
          extractArchive: mockExtractArchive,
        }),
      });

      await downloadScannerCli({
        ...MOCK_PROPERTIES,
        [ScannerProperty.SonarScannerCliMirror]: 'https://myUser:myPassword@mirror.com:80',
      });

      assert.strictEqual(mockDownload.mock.callCount(), 1);
      const mockDownloadTyped = mockDownload as Mock<typeof download>;
      assert.deepStrictEqual(
        mockDownloadTyped.mock.calls[0].arguments[0],
        `https://myUser:myPassword@mirror.com:80/sonar-scanner-cli-${SCANNER_CLI_VERSION}-windows-x64.zip`,
      );
      assert.deepStrictEqual(mockDownloadTyped.mock.calls[0].arguments[2], {
        headers: { Authorization: 'Basic bXlVc2VyOm15UGFzc3dvcmQ=' },
      });
    });
  });

  describe('runScannerCli', function () {
    it('should pass jvmOptions and scanner properties to scanner', async () => {
      const mockChildProcess = createMockChildProcess();
      const mockSpawn = mock.fn(() => mockChildProcess);

      setDeps({
        process: createMockProcessDeps({ platform: 'linux', env: {} }),
        spawn: mockSpawn as any,
      });

      const promise = runScannerCli({ jvmOptions: ['-Xmx512m'] }, MOCK_PROPERTIES, 'sonar-scanner');

      // Simulate process exit
      setTimeout(() => mockChildProcess.emit('exit', 0), 10);
      await promise;

      assert.strictEqual(mockSpawn.mock.callCount(), 1);
      assert.strictEqual(
        (mockSpawn as unknown as Mock<SpawnFn>).mock.calls[0].arguments[0],
        'sonar-scanner',
      );
    });

    it('should reject if SonarScanner CLI fails', async () => {
      const mockChildProcess = createMockChildProcess({ exitCode: 1 });
      const mockSpawn = mock.fn(() => mockChildProcess);

      setDeps({
        process: createMockProcessDeps({ platform: 'linux', env: {} }),
        spawn: mockSpawn as any,
      });

      const promise = runScannerCli({}, MOCK_PROPERTIES, 'sonar-scanner');

      // Simulate process exit with error
      setTimeout(() => mockChildProcess.emit('exit', 1), 10);

      await assert.rejects(promise, {
        message: 'SonarScanner CLI failed with code 1',
      });
    });

    it('should only forward non-scanner env vars to Scanner CLI', async () => {
      const mockChildProcess = createMockChildProcess();
      const mockSpawn = mock.fn(() => mockChildProcess);

      setDeps({
        process: createMockProcessDeps({
          platform: 'linux',
          env: {
            SONAR_TOKEN: 'sqa_sometoken',
            SONAR_SCANNER_SOME_VAR: 'some_value',
            CIRRUS_CI_SOME_VAR: 'some_value',
          },
        }),
        spawn: mockSpawn as any,
      });

      const promise = runScannerCli({}, MOCK_PROPERTIES, 'sonar-scanner');

      // Simulate process exit
      setTimeout(() => mockChildProcess.emit('exit', 0), 10);
      await promise;

      assert.strictEqual(mockSpawn.mock.callCount(), 1);
      const options = (mockSpawn as unknown as Mock<SpawnFn>).mock.calls[0].arguments[2] as {
        env: Record<string, string>;
      };
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
      const mockSpawn = mock.fn(() => mockChildProcess);

      const propertiesWithProxy = {
        ...MOCK_PROPERTIES,
        [ScannerProperty.SonarScannerProxyHost]: 'proxy',
        [ScannerProperty.SonarScannerProxyPort]: '9000',
        [ScannerProperty.SonarScannerProxyUser]: 'some-user',
        [ScannerProperty.SonarScannerProxyPassword]: 'password',
      };

      setDeps({
        process: createMockProcessDeps({ platform: 'linux', env: {} }),
        spawn: mockSpawn as any,
      });

      const promise = runScannerCli({}, propertiesWithProxy, 'sonar-scanner');

      // Simulate process exit
      setTimeout(() => mockChildProcess.emit('exit', 0), 10);
      await promise;

      assert.strictEqual(mockSpawn.mock.callCount(), 1);
      const mockSpawnTyped = mockSpawn as unknown as Mock<SpawnFn>;
      assert.strictEqual(mockSpawnTyped.mock.calls[0].arguments[0], 'sonar-scanner');
      assert.deepStrictEqual(mockSpawnTyped.mock.calls[0].arguments[1], [
        '-Dhttp.proxyHost=proxy',
        '-Dhttp.proxyPort=9000',
        '-Dhttp.proxyUser=some-user',
        '-Dhttp.proxyPassword=password',
      ]);
    });

    it('should pass https proxy options to scanner', async () => {
      const mockChildProcess = createMockChildProcess();
      const mockSpawn = mock.fn(() => mockChildProcess);

      const propertiesWithHttpsProxy = {
        [ScannerProperty.SonarToken]: 'token',
        [ScannerProperty.SonarHostUrl]: 'https://localhost:9000',
        [ScannerProperty.SonarScannerProxyHost]: 'proxy',
        [ScannerProperty.SonarScannerProxyPort]: '9000',
        [ScannerProperty.SonarScannerProxyUser]: 'some-user',
        [ScannerProperty.SonarScannerProxyPassword]: 'password',
      };

      setDeps({
        process: createMockProcessDeps({ platform: 'linux', env: {} }),
        spawn: mockSpawn as any,
      });

      const promise = runScannerCli({}, propertiesWithHttpsProxy, 'sonar-scanner');

      // Simulate process exit
      setTimeout(() => mockChildProcess.emit('exit', 0), 10);
      await promise;

      assert.strictEqual(mockSpawn.mock.callCount(), 1);
      const mockSpawnTyped = mockSpawn as unknown as Mock<SpawnFn>;
      assert.strictEqual(mockSpawnTyped.mock.calls[0].arguments[0], 'sonar-scanner');
      assert.deepStrictEqual(mockSpawnTyped.mock.calls[0].arguments[1], [
        '-Dhttps.proxyHost=proxy',
        '-Dhttps.proxyPort=9000',
        '-Dhttps.proxyUser=some-user',
        '-Dhttps.proxyPassword=password',
      ]);
    });
  });

  describe('normalizePlatformName', function () {
    it('detect Windows', function () {
      setDeps({
        process: createMockProcessDeps({ platform: 'win32' }),
      });
      assert.strictEqual(normalizePlatformName(), 'windows');
    });

    it('detect Mac', function () {
      setDeps({
        process: createMockProcessDeps({ platform: 'darwin' }),
      });
      assert.strictEqual(normalizePlatformName(), 'macosx');
    });

    it('detect Linux', function () {
      setDeps({
        process: createMockProcessDeps({ platform: 'linux' }),
      });
      assert.strictEqual(normalizePlatformName(), 'linux');
    });

    it('throw if something else', function () {
      setDeps({
        process: createMockProcessDeps({ platform: 'non-existing-os' as NodeJS.Platform }),
      });
      assert.throws(() => normalizePlatformName(), {
        message: `Your platform 'non-existing-os' is currently not supported.`,
      });
    });
  });
});
