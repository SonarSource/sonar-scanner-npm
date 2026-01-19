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

import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { setDeps, resetDeps } from '../../src/deps';
import * as platform from '../../src/platform';
import { createMockProcessDeps, createMockFsDeps } from './test-helpers';

// Mock logging to suppress output
const mockLog = mock.fn();
mock.method(console, 'log', mockLog);

beforeEach(() => {
  mockLog.mock.resetCalls();
});

afterEach(() => {
  resetDeps();
});

describe('getPlatformInfo', () => {
  it('detect macos', () => {
    setDeps({
      process: createMockProcessDeps({ platform: 'darwin', arch: 'arm64' }),
    });

    assert.strictEqual(platform.getSupportedOS(), 'darwin');
    assert.strictEqual(platform.getArch(), 'arm64');
  });

  it('detect windows', () => {
    setDeps({
      process: createMockProcessDeps({ platform: 'win32', arch: 'x64' }),
    });

    assert.strictEqual(platform.getSupportedOS(), 'win32');
    assert.strictEqual(platform.getArch(), 'x64');
  });

  it('detect linux flavor', () => {
    setDeps({
      process: createMockProcessDeps({ platform: 'openbsd', arch: 'x64' }),
    });

    assert.strictEqual(platform.getSupportedOS(), 'openbsd');
    assert.strictEqual(platform.getArch(), 'x64');
  });

  it('detect alpine', () => {
    setDeps({
      process: createMockProcessDeps({ platform: 'linux', arch: 'x64' }),
      fs: createMockFsDeps({
        readFileSync: mock.fn(() => Buffer.from('NAME="Alpine Linux"\nID=alpine')) as any,
      }),
    });

    assert.strictEqual(platform.getSupportedOS(), 'alpine');
    assert.strictEqual(platform.getArch(), 'x64');
  });

  it('detect alpine with fallback', () => {
    let callCount = 0;
    setDeps({
      process: createMockProcessDeps({ platform: 'linux', arch: 'x64' }),
      fs: createMockFsDeps({
        readFileSync: mock.fn((filePath: string) => {
          callCount++;
          if (callCount === 1) {
            throw new Error('File not found');
          }
          return Buffer.from('NAME="Alpine Linux"\nID=alpine');
        }) as any,
      }),
    });

    assert.strictEqual(platform.getSupportedOS(), 'alpine');
    assert.strictEqual(platform.getArch(), 'x64');
  });

  it('failed to detect alpine', () => {
    setDeps({
      process: createMockProcessDeps({ platform: 'linux', arch: 'x64' }),
      fs: createMockFsDeps({
        readFileSync: mock.fn(() => {
          throw new Error('File not found');
        }),
      }),
    });

    assert.strictEqual(platform.getSupportedOS(), 'linux');
    assert.strictEqual(platform.getArch(), 'x64');

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
