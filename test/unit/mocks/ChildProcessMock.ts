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
import { ChildProcess, exec, spawn } from 'node:child_process';
import { mock, Mock } from 'node:test';

export class ChildProcessMock {
  private exitCode: number = 0;

  private stdout: string = '';
  private stderr: string = '';

  private childProcessMock: Partial<ChildProcess> | null = null;

  private commandHistory: string[] = [];

  private spawnMock: Mock<typeof spawn>;
  private execMock: Mock<typeof exec>;

  constructor() {
    this.spawnMock = mock.fn(this.handleSpawn.bind(this) as typeof spawn);
    this.execMock = mock.fn(this.handleExec.bind(this) as typeof exec);
    mock.method(require('child_process'), 'spawn', this.spawnMock);
    mock.method(require('child_process'), 'exec', this.execMock);
  }

  setExitCode(exitCode: number) {
    this.exitCode = exitCode;
  }

  setOutput(stdout?: string, stderr?: string) {
    this.stdout = stdout ?? '';
    this.stderr = stderr ?? '';
  }

  setChildProcessMock(childProcessMock: Partial<ChildProcess> | null) {
    this.childProcessMock = childProcessMock;
  }

  getCommandHistory() {
    return this.commandHistory;
  }

  handleSpawn(command: string): ChildProcess {
    this.commandHistory.push(command);
    const mockFn = mock.fn;
    const exitCode = this.exitCode;
    const stdout = this.stdout;
    const stderr = this.stderr;
    return {
      on: mockFn((_event: string, callback: (code: number) => void) => {
        if (_event === 'exit') {
          callback(exitCode);
        }
      }),
      stdin: { write: mockFn(), end: mockFn() },
      stdout: {
        on: mockFn((_event: string, callback: (data: string) => void) => callback(stdout)),
      },
      stderr: {
        on: mockFn((_event: string, callback: (data: string) => void) => callback(stderr)),
      },
      ...this.childProcessMock,
    } as unknown as ChildProcess;
  }

  handleExec(
    command: string,
    callback: (error?: Error | null, result?: { stdout: string; stderr: string }) => void,
  ): ChildProcess {
    this.commandHistory.push(command);
    const error = this.exitCode === 0 ? null : new Error('Command failed by mock');
    callback(error, {
      stdout: this.stdout,
      stderr: this.stderr,
    });
    return {} as ChildProcess;
  }

  reset() {
    this.exitCode = 0;
    this.stdout = '';
    this.stderr = '';
    this.childProcessMock = null;
    this.commandHistory = [];
    this.spawnMock.mock.resetCalls();
    this.execMock.mock.resetCalls();
  }
}
