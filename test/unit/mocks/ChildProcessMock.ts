/*
 * sonar-scanner-npm
 * Copyright (C) 2022-2025 SonarSource SA
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
import { ChildProcess, exec, spawn } from 'child_process';

export class ChildProcessMock {
  private exitCode: number = 0;

  private stdout: string = '';
  private stderr: string = '';

  private mock: Partial<ChildProcess> | null = null;

  private commandHistory: string[] = [];

  constructor() {
    jest.mocked(spawn).mockImplementation((this.handleSpawn as any).bind(this));
    jest.mocked(exec).mockImplementation((this.handleExec as any).bind(this));
  }

  setExitCode(exitCode: number) {
    this.exitCode = exitCode;
  }

  setOutput(stdout?: string, stderr?: string) {
    this.stdout = stdout ?? '';
    this.stderr = stderr ?? '';
  }

  setChildProcessMock(mock: Partial<ChildProcess> | null) {
    this.mock = mock;
  }

  getCommandHistory() {
    return this.commandHistory;
  }

  handleSpawn(command: string) {
    this.commandHistory.push(command);
    return {
      on: jest.fn().mockImplementation((event, callback) => {
        if (event === 'exit') {
          callback(this.exitCode);
        }
      }),
      stdin: { write: jest.fn(), end: jest.fn() },
      stdout: { on: jest.fn().mockImplementation((_event, callback) => callback(this.stdout)) },
      stderr: { on: jest.fn().mockImplementation((_event, callback) => callback(this.stderr)) },
      ...this.mock,
    };
  }

  handleExec(
    command: string,
    callback: (error?: Error, { stdout, stderr }?: { stdout: string; stderr: string }) => void,
  ) {
    this.commandHistory.push(command);
    const error = this.exitCode === 0 ? undefined : new Error('Command failed by mock');
    callback(error, {
      stdout: this.stdout,
      stderr: this.stderr,
    });
  }

  reset() {
    this.exitCode = 0;
    this.stdout = '';
    this.stderr = '';
    this.mock = null;
    this.commandHistory = [];
    jest.clearAllMocks();
  }
}
