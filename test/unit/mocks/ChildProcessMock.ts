/*
 * sonar-scanner-npm
 * Copyright (C) 2022-2024 SonarSource SA
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
import { spawn } from 'child_process';

export class ChildProcessMock {
  private exitCode: number = 0;

  private stdout: string = '';

  private stderr: string = '';

  constructor() {
    jest.mocked(spawn).mockImplementation((this.handleSpawn as any).bind(this));
  }

  setExitCode(exitCode: number) {
    this.exitCode = exitCode;
  }

  setOutput(stdout?: string, stderr?: string) {
    this.stdout = stdout ?? '';
    this.stderr = stderr ?? '';
  }

  handleSpawn() {
    return {
      on: jest.fn().mockImplementation((event, callback) => {
        if (event === 'exit') {
          callback(this.exitCode);
        }
      }),
      stdout: { on: jest.fn().mockImplementation((event, callback) => callback(this.stdout)) },
      stderr: { on: jest.fn().mockImplementation((event, callback) => callback(this.stderr)) },
    };
  }

  reset() {
    this.exitCode = 0;
    this.stdout = '';
    this.stderr = '';
    jest.clearAllMocks();
  }
}
