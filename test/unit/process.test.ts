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
import sinon from 'sinon';
import { SCANNER_CLI_DEFAULT_BIN_NAME, WINDOWS_WHERE_EXE_PATH } from '../../src/constants';
import { locateExecutableFromPath } from '../../src/process';
import { ChildProcessMock } from './mocks/ChildProcessMock';

jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('../../src/request');
jest.mock('../../src/file');
jest.mock('../../src/logging');

const childProcessHandler = new ChildProcessMock();

beforeEach(() => {
  childProcessHandler.reset();
});

describe('process', () => {
  describe('locateExecutableFromPath', () => {
    it('should use windows where.exe when on windows', async () => {
      // mock windows with stub
      const stub = sinon.stub(process, 'platform').value('win32');

      childProcessHandler.setOutput('/bin/path/to/stuff\n', '');

      expect(await locateExecutableFromPath(SCANNER_CLI_DEFAULT_BIN_NAME)).toBe(
        '/bin/path/to/stuff',
      );
      expect(childProcessHandler.getCommandHistory()).toContain(
        `${WINDOWS_WHERE_EXE_PATH} ${SCANNER_CLI_DEFAULT_BIN_NAME}`,
      );

      stub.restore();
    });

    it('should detect locally installed command', async () => {
      childProcessHandler.setOutput('some output\n', '');

      expect(await locateExecutableFromPath(SCANNER_CLI_DEFAULT_BIN_NAME)).toBe('some output');
    });

    it('should not detect locally installed command (when exit code is 1)', async () => {
      childProcessHandler.setExitCode(1);

      expect(await locateExecutableFromPath(SCANNER_CLI_DEFAULT_BIN_NAME)).toBe(null);
    });

    it('should not detect locally installed command (when empty stdout)', async () => {
      childProcessHandler.setOutput('', '');

      expect(await locateExecutableFromPath(SCANNER_CLI_DEFAULT_BIN_NAME)).toBe(null);
    });
  });
});
