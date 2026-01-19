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

import { EventEmitter } from 'node:events';
import path from 'node:path';
import { mock } from 'node:test';
import type { Dependencies } from '../../src/deps';

/**
 * Creates a mock child process for testing spawned commands.
 * The process does NOT auto-exit - tests must manually emit 'exit' event.
 */
export function createMockChildProcess(options?: { exitCode?: number; autoExit?: boolean }) {
  const exitCode = options?.exitCode ?? 0;
  const autoExit = options?.autoExit ?? false;
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

  // Only auto-exit if explicitly requested
  if (autoExit) {
    setImmediate(() => childProcess.emit('exit', exitCode));
  }

  return childProcess;
}

/**
 * Returns a path relative to the fixtures directory.
 */
export function fixturePath(fixtureName: string): string {
  return path.join(__dirname, 'fixtures', fixtureName);
}

/**
 * Creates mock dependencies for fs operations.
 * Returns the full Dependencies['fs'] type for use with setDeps().
 */
export function createMockFsDeps(overrides: Partial<Dependencies['fs']> = {}): Dependencies['fs'] {
  return {
    existsSync: mock.fn(() => false),
    readFileSync: mock.fn(() => Buffer.from('')),
    readFile: mock.fn((path: string, cb: (err: Error | null, data: Buffer) => void) =>
      cb(null, Buffer.from('')),
    ),
    mkdirSync: mock.fn(),
    createReadStream: mock.fn(() => ({
      pipe: function () {
        return this;
      },
    })),
    createWriteStream: mock.fn(() => ({
      on: mock.fn(),
      once: mock.fn(),
      emit: mock.fn(),
      end: mock.fn(),
      write: mock.fn(),
    })),
    remove: mock.fn(() => Promise.resolve()),
    writeFile: mock.fn(() => Promise.resolve()),
    exists: mock.fn(() => Promise.resolve(false)),
    ensureDir: mock.fn(() => Promise.resolve()),
    ...overrides,
  } as Dependencies['fs'];
}

/**
 * Creates mock dependencies for process information.
 * Returns the full Dependencies['process'] type for use with setDeps().
 */
export function createMockProcessDeps(
  overrides: Partial<Dependencies['process']> = {},
): Dependencies['process'] {
  return {
    platform: 'linux',
    arch: 'x64',
    env: {},
    cwd: () => '/mock/cwd',
    ...overrides,
  } as Dependencies['process'];
}

/**
 * Creates mock dependencies for HTTP operations.
 * Returns the full Dependencies['http'] type for use with setDeps().
 */
export function createMockHttpDeps(
  overrides: Partial<Dependencies['http']> = {},
): Dependencies['http'] {
  return {
    fetch: mock.fn(() => Promise.resolve({ data: {} })),
    download: mock.fn(() => Promise.resolve()),
    ...overrides,
  } as Dependencies['http'];
}

/**
 * Creates mock dependencies for file operations.
 * Returns the full Dependencies['file'] type for use with setDeps().
 */
export function createMockFileDeps(
  overrides: Partial<Dependencies['file']> = {},
): Dependencies['file'] {
  return {
    extractArchive: mock.fn(() => Promise.resolve()),
    ...overrides,
  } as Dependencies['file'];
}
