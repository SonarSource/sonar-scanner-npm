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
import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { SCANNER_CLI_DEFAULT_BIN_NAME, WINDOWS_WHERE_EXE_PATH } from '../../src/constants';
import { locateExecutableFromPath, ProcessProcessDeps } from '../../src/process';

// Mock console.log to suppress output
mock.method(console, 'log', () => {});

function createMockProcessDeps(overrides: Partial<ProcessProcessDeps> = {}): ProcessProcessDeps {
  return {
    platform: 'linux',
    arch: 'x64',
    ...overrides,
  };
}

describe('process', () => {
  describe('locateExecutableFromPath', () => {
    it('should use windows where.exe when on windows', async () => {
      const mockExecAsync = mock.fn(() =>
        Promise.resolve({ stdout: '/bin/path/to/stuff\n', stderr: '' }),
      );
      const processDeps = createMockProcessDeps({ platform: 'win32' });

      const result = await locateExecutableFromPath(SCANNER_CLI_DEFAULT_BIN_NAME, {
        processDeps,
        execAsyncFn: mockExecAsync,
      });

      assert.strictEqual(result, '/bin/path/to/stuff');
      assert.strictEqual(mockExecAsync.mock.callCount(), 1);
      assert.ok(
        mockExecAsync.mock.calls[0].arguments[0].includes(
          `${WINDOWS_WHERE_EXE_PATH} ${SCANNER_CLI_DEFAULT_BIN_NAME}`,
        ),
      );
    });

    it('should detect locally installed command', async () => {
      const mockExecAsync = mock.fn(() => Promise.resolve({ stdout: 'some output\n', stderr: '' }));
      const processDeps = createMockProcessDeps({ platform: 'linux' });

      const result = await locateExecutableFromPath(SCANNER_CLI_DEFAULT_BIN_NAME, {
        processDeps,
        execAsyncFn: mockExecAsync,
      });

      assert.strictEqual(result, 'some output');
    });

    it('should not detect locally installed command (when exit code is 1)', async () => {
      const mockExecAsync = mock.fn(() => Promise.reject(new Error('command not found')));
      const processDeps = createMockProcessDeps({ platform: 'linux' });

      const result = await locateExecutableFromPath(SCANNER_CLI_DEFAULT_BIN_NAME, {
        processDeps,
        execAsyncFn: mockExecAsync,
      });

      assert.strictEqual(result, null);
    });

    it('should not detect locally installed command (when empty stdout)', async () => {
      const mockExecAsync = mock.fn(() => Promise.resolve({ stdout: '', stderr: '' }));
      const processDeps = createMockProcessDeps({ platform: 'linux' });

      const result = await locateExecutableFromPath(SCANNER_CLI_DEFAULT_BIN_NAME, {
        processDeps,
        execAsyncFn: mockExecAsync,
      });

      assert.strictEqual(result, null);
    });
  });
});
