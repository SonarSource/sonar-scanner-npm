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

import { describe, it, beforeEach, mock, Mock } from 'node:test';
import assert from 'node:assert';
import sinon from 'sinon';
import { scan, type ScanDeps } from '../../src/scan';
import { ScannerProperty } from '../../src/types';
import { getLogLevel, setLogLevel, LogLevel } from '../../src/logging';

// Mock console.log to suppress output and capture log calls
const mockLog = mock.fn();
mock.method(console, 'log', mockLog);

// Type definitions for mock functions
type RunScannerCliFn = (opts: unknown, props: unknown, binPath: string) => Promise<void>;
type RunScannerEngineFn = (jrePath: string, ...rest: unknown[]) => Promise<void>;

// Create mock functions for all dependencies
const mockServerSupportsJREProvisioning = mock.fn(() => Promise.resolve(false));
const mockFetchJRE = mock.fn(() => Promise.resolve('/some-provisioned-jre'));
const mockDownloadScannerCli = mock.fn(() => Promise.resolve('/path/to/scanner-cli'));
const mockRunScannerCli = mock.fn<RunScannerCliFn>(() => Promise.resolve());
const mockFetchScannerEngine = mock.fn(() => Promise.resolve('/path/to/scanner-engine'));
const mockRunScannerEngine = mock.fn<RunScannerEngineFn>(() => Promise.resolve());
const mockLocateExecutableFromPath = mock.fn<() => Promise<string | null>>(() =>
  Promise.resolve('/usr/bin/java'),
);

function createScanDeps(): ScanDeps {
  return {
    serverSupportsJREProvisioningFn: mockServerSupportsJREProvisioning,
    fetchJREFn: mockFetchJRE,
    downloadScannerCliFn: mockDownloadScannerCli,
    runScannerCliFn: mockRunScannerCli,
    fetchScannerEngineFn: mockFetchScannerEngine,
    runScannerEngineFn: mockRunScannerEngine,
    locateExecutableFromPathFn: mockLocateExecutableFromPath,
  };
}

beforeEach(() => {
  mockLog.mock.resetCalls();
  mockServerSupportsJREProvisioning.mock.resetCalls();
  mockFetchJRE.mock.resetCalls();
  mockDownloadScannerCli.mock.resetCalls();
  mockRunScannerCli.mock.resetCalls();
  mockFetchScannerEngine.mock.resetCalls();
  mockRunScannerEngine.mock.resetCalls();
  mockLocateExecutableFromPath.mock.resetCalls();

  // Reset implementations to default
  mockServerSupportsJREProvisioning.mock.mockImplementation(() => Promise.resolve(false));
  mockFetchJRE.mock.mockImplementation(() => Promise.resolve('/some-provisioned-jre'));
  mockDownloadScannerCli.mock.mockImplementation(() => Promise.resolve('/path/to/scanner-cli'));
  mockLocateExecutableFromPath.mock.mockImplementation(() => Promise.resolve('/usr/bin/java'));

  // Reset log level to INFO
  setLogLevel(LogLevel.INFO);

  // Restore any sinon stubs
  sinon.restore();
});

// Helper to check if a log message was recorded
function assertLogged(...patterns: (string | RegExp)[]): void {
  const found = mockLog.mock.calls.some(call =>
    patterns.every(pattern =>
      call.arguments.some((arg: unknown) => {
        if (typeof arg !== 'string') return false;
        if (pattern instanceof RegExp) return pattern.test(arg);
        return arg.includes(pattern);
      }),
    ),
  );
  assert.ok(
    found,
    `Expected log matching ${patterns}. Calls: ${JSON.stringify(mockLog.mock.calls.map(c => c.arguments))}`,
  );
}

describe('scan', () => {
  it('should default the log level to INFO', async () => {
    // Stub process.cwd to point to a test directory
    sinon.stub(process, 'cwd').returns(__dirname);

    await scan({}, undefined, createScanDeps());
    assert.strictEqual(getLogLevel(), LogLevel.INFO);
  });

  it('should set the log level to DEBUG when verbose mode is enabled', async () => {
    sinon.stub(process, 'cwd').returns(__dirname);

    await scan({ options: { 'sonar.verbose': 'true' } }, undefined, createScanDeps());
    assert.strictEqual(getLogLevel(), LogLevel.DEBUG);
  });

  it('should set the log level to the value provided by the user', async () => {
    sinon.stub(process, 'cwd').returns(__dirname);

    await scan({ options: { 'sonar.log.level': 'DEBUG' } }, undefined, createScanDeps());
    assert.strictEqual(getLogLevel(), LogLevel.DEBUG);
  });

  it('should set the log level to ERROR when specified', async () => {
    sinon.stub(process, 'cwd').returns(__dirname);

    await scan({ options: { 'sonar.log.level': 'ERROR' } }, undefined, createScanDeps());
    assert.strictEqual(getLogLevel(), LogLevel.ERROR);
  });

  it('should set the log level to WARN when specified', async () => {
    sinon.stub(process, 'cwd').returns(__dirname);

    await scan({ options: { 'sonar.log.level': 'WARN' } }, undefined, createScanDeps());
    assert.strictEqual(getLogLevel(), LogLevel.WARN);
  });

  it('should set the log level to TRACE when specified', async () => {
    sinon.stub(process, 'cwd').returns(__dirname);

    await scan({ options: { 'sonar.log.level': 'TRACE' } }, undefined, createScanDeps());
    assert.strictEqual(getLogLevel(), LogLevel.TRACE);
  });

  it('should default to INFO for invalid log level', async () => {
    sinon.stub(process, 'cwd').returns(__dirname);

    await scan({ options: { 'sonar.log.level': 'INVALID' } }, undefined, createScanDeps());
    assert.strictEqual(getLogLevel(), LogLevel.INFO);
  });

  it('should output the current version of the scanner', async () => {
    sinon.stub(process, 'cwd').returns(__dirname);
    mockServerSupportsJREProvisioning.mock.mockImplementation(() => Promise.resolve(false));

    await scan({}, undefined, createScanDeps());
    assertLogged('Version:', 'SNAPSHOT');
  });

  it('should output the current platform', async () => {
    sinon.stub(process, 'cwd').returns(__dirname);
    mockServerSupportsJREProvisioning.mock.mockImplementation(() => Promise.resolve(false));

    await scan({}, undefined, createScanDeps());
    assertLogged('Platform:');
  });

  describe('when server does not support JRE provisioning', () => {
    it('should download and run SonarScanner CLI', async () => {
      sinon.stub(process, 'cwd').returns(__dirname);
      mockServerSupportsJREProvisioning.mock.mockImplementation(() => Promise.resolve(false));
      mockDownloadScannerCli.mock.mockImplementation(() => Promise.resolve('/path/to/scanner-cli'));

      await scan({ serverUrl: 'http://localhost:9000' }, undefined, createScanDeps());

      assert.strictEqual(mockFetchJRE.mock.callCount(), 0);
      assert.strictEqual(mockRunScannerEngine.mock.callCount(), 0);
      assert.strictEqual(mockRunScannerCli.mock.callCount(), 1);
      assert.strictEqual(mockRunScannerCli.mock.calls[0].arguments[2], '/path/to/scanner-cli');
    });

    it('should use local scanner if requested', async () => {
      sinon.stub(process, 'cwd').returns(__dirname);
      mockServerSupportsJREProvisioning.mock.mockImplementation(() => Promise.resolve(false));
      mockLocateExecutableFromPath.mock.mockImplementation(() =>
        Promise.resolve('/bin/sonar-scanner'),
      );

      await scan(
        { serverUrl: 'http://localhost:9000', localScannerCli: true },
        undefined,
        createScanDeps(),
      );

      assert.strictEqual(mockDownloadScannerCli.mock.callCount(), 0);
      assert.strictEqual(mockRunScannerCli.mock.callCount(), 1);
      assert.strictEqual(mockRunScannerCli.mock.calls[0].arguments[2], '/bin/sonar-scanner');
    });

    it('should fail if local scanner is requested but not found', async () => {
      sinon.stub(process, 'cwd').returns(__dirname);
      mockServerSupportsJREProvisioning.mock.mockImplementation(() => Promise.resolve(false));
      mockLocateExecutableFromPath.mock.mockImplementation(() =>
        Promise.resolve(null as string | null),
      );

      await assert.rejects(
        scan(
          { serverUrl: 'http://localhost:9000', localScannerCli: true },
          undefined,
          createScanDeps(),
        ),
        Error,
      );

      assert.strictEqual(mockDownloadScannerCli.mock.callCount(), 0);
      assert.strictEqual(mockRunScannerCli.mock.callCount(), 0);
      assertLogged(/SonarScanner CLI not found in PATH/);
    });
  });

  describe('when server supports provisioning', () => {
    it('should fetch the JRE', async () => {
      sinon.stub(process, 'cwd').returns(__dirname);
      mockServerSupportsJREProvisioning.mock.mockImplementation(() => Promise.resolve(true));
      mockFetchJRE.mock.mockImplementation(() => Promise.resolve('/some-provisioned-jre'));

      await scan({ serverUrl: 'http://localhost:9000' }, undefined, createScanDeps());

      assert.strictEqual(mockFetchJRE.mock.callCount(), 1);
      assert.strictEqual(mockRunScannerEngine.mock.calls[0].arguments[0], '/some-provisioned-jre');
    });

    it('should not fetch the JRE if the JRE path is explicitly specified', async () => {
      sinon.stub(process, 'cwd').returns(__dirname);
      mockServerSupportsJREProvisioning.mock.mockImplementation(() => Promise.resolve(true));

      await scan(
        {
          serverUrl: 'http://localhost:9000',
          options: { [ScannerProperty.SonarScannerJavaExePath]: 'path/to/java' },
        },
        undefined,
        createScanDeps(),
      );

      assert.strictEqual(mockFetchJRE.mock.callCount(), 0);
      assert.strictEqual(mockRunScannerEngine.mock.calls[0].arguments[0], 'path/to/java');
    });

    it('should not fetch the JRE if skipping JRE provisioning explicitly', async () => {
      sinon.stub(process, 'cwd').returns(__dirname);
      mockServerSupportsJREProvisioning.mock.mockImplementation(() => Promise.resolve(true));
      mockLocateExecutableFromPath.mock.mockImplementation(() => Promise.resolve('/usr/bin/java'));

      await scan(
        {
          serverUrl: 'http://localhost:9000',
          options: {
            [ScannerProperty.SonarScannerSkipJreProvisioning]: 'true',
          },
        },
        undefined,
        createScanDeps(),
      );

      assert.strictEqual(mockFetchJRE.mock.callCount(), 0);
      assert.strictEqual(mockLocateExecutableFromPath.mock.callCount(), 1);
      assert.strictEqual(mockRunScannerEngine.mock.calls[0].arguments[0], '/usr/bin/java');
    });

    it('should fail when skipping JRE provisioning without java in PATH', async () => {
      sinon.stub(process, 'cwd').returns(__dirname);
      mockServerSupportsJREProvisioning.mock.mockImplementation(() => Promise.resolve(true));
      mockLocateExecutableFromPath.mock.mockImplementation(() =>
        Promise.resolve(null as string | null),
      );

      await assert.rejects(
        scan(
          {
            serverUrl: 'http://localhost:9000',
            options: {
              [ScannerProperty.SonarScannerSkipJreProvisioning]: 'true',
            },
          },
          undefined,
          createScanDeps(),
        ),
        Error,
      );

      assert.strictEqual(mockRunScannerEngine.mock.callCount(), 0);
      assert.strictEqual(mockRunScannerCli.mock.callCount(), 0);
      assertLogged(/Java not found in PATH/);
    });
  });
});
