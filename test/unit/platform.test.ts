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

import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import * as platform from '../../src/platform';
import { PlatformFsDeps, PlatformProcessDeps } from '../../src/platform';

// Mock logging to suppress output
const mockLog = mock.fn();
mock.method(console, 'log', mockLog);

function createMockProcessDeps(overrides: Partial<PlatformProcessDeps> = {}): PlatformProcessDeps {
  return {
    platform: 'linux',
    arch: 'x64',
    env: {},
    cwd: () => '/test',
    ...overrides,
  };
}

function createMockFsDeps(readFileSyncResult?: string | Error): Partial<PlatformFsDeps> {
  return {
    readFileSync: mock.fn(() => {
      if (readFileSyncResult instanceof Error) {
        throw readFileSyncResult;
      }
      return Buffer.from(readFileSyncResult ?? '');
    }) as unknown as PlatformPlatformFsDeps['readFileSync'],
  };
}

beforeEach(() => {
  mockLog.mock.resetCalls();
});

describe('getPlatformInfo', () => {
  it('detect macos', () => {
    const processDeps = createMockProcessDeps({ platform: 'darwin', arch: 'arm64' });

    assert.strictEqual(platform.getSupportedOS(processDeps), 'darwin');
    assert.strictEqual(platform.getArch(processDeps), 'arm64');
  });

  it('detect windows', () => {
    const processDeps = createMockProcessDeps({ platform: 'win32', arch: 'x64' });

    assert.strictEqual(platform.getSupportedOS(processDeps), 'win32');
    assert.strictEqual(platform.getArch(processDeps), 'x64');
  });

  it('detect linux flavor', () => {
    const processDeps = createMockProcessDeps({ platform: 'openbsd', arch: 'x64' });

    assert.strictEqual(platform.getSupportedOS(processDeps), 'openbsd');
    assert.strictEqual(platform.getArch(processDeps), 'x64');
  });

  it('detect alpine', () => {
    const processDeps = createMockProcessDeps({ platform: 'linux', arch: 'x64' });
    const fsDeps = createMockFsDeps('NAME="Alpine Linux"\nID=alpine');

    assert.strictEqual(platform.getSupportedOS(processDeps, fsDeps as PlatformFsDeps), 'alpine');
    assert.strictEqual(platform.getArch(processDeps), 'x64');
  });

  it('detect alpine with fallback', () => {
    const processDeps = createMockProcessDeps({ platform: 'linux', arch: 'x64' });

    // First call throws, second returns alpine
    let callCount = 0;
    const fsDeps: Partial<PlatformFsDeps> = {
      readFileSync: mock.fn((filePath: string) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('File not found');
        }
        return Buffer.from('NAME="Alpine Linux"\nID=alpine');
      }) as unknown as PlatformPlatformFsDeps['readFileSync'],
    };

    assert.strictEqual(platform.getSupportedOS(processDeps, fsDeps as PlatformFsDeps), 'alpine');
    assert.strictEqual(platform.getArch(processDeps), 'x64');
  });

  it('failed to detect alpine', () => {
    const processDeps = createMockProcessDeps({ platform: 'linux', arch: 'x64' });
    const fsDeps: Partial<PlatformFsDeps> = {
      readFileSync: mock.fn(() => {
        throw new Error('File not found');
      }) as unknown as PlatformPlatformFsDeps['readFileSync'],
    };

    assert.strictEqual(platform.getSupportedOS(processDeps, fsDeps as PlatformFsDeps), 'linux');
    assert.strictEqual(platform.getArch(processDeps), 'x64');

    // Check that warning was logged - the message could be in arguments[0] or arguments[1]
    assert.ok(
      mockLog.mock.calls.some(call =>
        call.arguments.some(
          (arg: unknown) =>
            typeof arg === 'string' &&
            arg.includes('Failed to read /etc/os-release or /usr/lib/os-release'),
        ),
      ),
    );
  });
});
