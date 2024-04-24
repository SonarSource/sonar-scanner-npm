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
import path from 'path';
import sinon from 'sinon';
import { SCANNER_CLI_DEFAULT_BIN_NAME, SCANNER_CLI_INSTALL_PATH } from '../../src/constants';
import { extractArchive } from '../../src/file';
import { LogLevel, log } from '../../src/logging';
import { download } from '../../src/request';
import {
  downloadScannerCli,
  normalizePlatformName,
  runScannerCli,
  tryLocalSonarScannerExecutable,
} from '../../src/scanner-cli';
import { ScannerProperty } from '../../src/types';
import { ChildProcessMock } from './mocks/ChildProcessMock';

jest.mock('child_process');
jest.mock('../../src/request');
jest.mock('../../src/file');
jest.mock('../../src/logging');

const childProcessHandler = new ChildProcessMock();

const MOCK_PROPERTIES = {
  [ScannerProperty.SonarToken]: 'token',
  [ScannerProperty.SonarHostUrl]: 'http://localhost:9000',
  [ScannerProperty.SonarUserHome]: 'path/to/user/home',
};

beforeEach(() => {
  childProcessHandler.reset();
});

describe('scanner-cli', () => {
  describe('tryLocalSonarScannerExecutable', () => {
    it('should detect locally installed scanner-cli', async () => {
      expect(await tryLocalSonarScannerExecutable(SCANNER_CLI_DEFAULT_BIN_NAME)).toBe(true);
    });

    it('should not detect locally installed scanner-cli', async () => {
      childProcessHandler.setExitCode(1);

      expect(await tryLocalSonarScannerExecutable(SCANNER_CLI_DEFAULT_BIN_NAME)).toBe(false);
    });
  });

  describe('downloadScannerCli', function () {
    it('should reject invalid versions', () => {
      expect(
        downloadScannerCli({
          [ScannerProperty.SonarScannerCliVersion]: 'not a version',
        }),
      ).rejects.toBeDefined();
    });

    it('should use already downloaded version', async () => {
      const stub = sinon.stub(process, 'platform').value('linux');

      expect(await downloadScannerCli(MOCK_PROPERTIES)).toBe(
        path.join(
          MOCK_PROPERTIES[ScannerProperty.SonarUserHome],
          SCANNER_CLI_INSTALL_PATH,
          'sonar-scanner-5.0.1.3006-linux/bin/sonar-scanner',
        ),
      );
      expect(download).not.toHaveBeenCalled();

      stub.restore();
    });

    it('should download SonarScanner CLI if it does not exist on Unix', async () => {
      childProcessHandler.setExitCode(1);
      const stub = sinon.stub(process, 'platform').value('linux');

      const binPath = await downloadScannerCli(MOCK_PROPERTIES);

      expect(await downloadScannerCli(MOCK_PROPERTIES)).toBe(
        path.join(
          MOCK_PROPERTIES[ScannerProperty.SonarUserHome],
          SCANNER_CLI_INSTALL_PATH,
          'sonar-scanner-5.0.1.3006-linux/bin/sonar-scanner',
        ),
      );
      expect(download).toHaveBeenLastCalledWith(
        'https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-5.0.1.3006-linux.zip',
        path.join(
          MOCK_PROPERTIES[ScannerProperty.SonarUserHome],
          SCANNER_CLI_INSTALL_PATH,
          'sonar-scanner-5.0.1.3006-linux.zip',
        ),
      );
      expect(extractArchive).toHaveBeenLastCalledWith(
        path.join(
          MOCK_PROPERTIES[ScannerProperty.SonarUserHome],
          SCANNER_CLI_INSTALL_PATH,
          'sonar-scanner-5.0.1.3006-linux.zip',
        ),
        path.join(MOCK_PROPERTIES[ScannerProperty.SonarUserHome], SCANNER_CLI_INSTALL_PATH),
      );
      expect(binPath).toBe(
        path.join(
          MOCK_PROPERTIES[ScannerProperty.SonarUserHome],
          SCANNER_CLI_INSTALL_PATH,
          'sonar-scanner-5.0.1.3006-linux/bin/sonar-scanner',
        ),
      );

      stub.restore();
    });

    it('should download SonarScanner CLI if it does not exist on Windows', async () => {
      childProcessHandler.setExitCode(1);
      const stub = sinon.stub(process, 'platform').value('win32');

      const binPath = await downloadScannerCli(MOCK_PROPERTIES);

      expect(download).toHaveBeenLastCalledWith(
        'https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-5.0.1.3006-windows.zip',
        path.join(
          MOCK_PROPERTIES[ScannerProperty.SonarUserHome],
          SCANNER_CLI_INSTALL_PATH,
          'sonar-scanner-5.0.1.3006-windows.zip',
        ),
      );
      expect(extractArchive).toHaveBeenLastCalledWith(
        path.join(
          MOCK_PROPERTIES[ScannerProperty.SonarUserHome],
          SCANNER_CLI_INSTALL_PATH,
          'sonar-scanner-5.0.1.3006-windows.zip',
        ),
        path.join(MOCK_PROPERTIES[ScannerProperty.SonarUserHome], SCANNER_CLI_INSTALL_PATH),
      );
      expect(binPath).toBe(
        path.join(
          MOCK_PROPERTIES[ScannerProperty.SonarUserHome],
          SCANNER_CLI_INSTALL_PATH,
          'sonar-scanner-5.0.1.3006-windows/bin/sonar-scanner.bat',
        ),
      );

      stub.restore();
    });
  });

  describe('runScannerCli', function () {
    it('should pass jvmOptions and scanner properties to scanner', async () => {
      await runScannerCli(
        {
          jvmOptions: ['-Xmx512m'],
        },
        MOCK_PROPERTIES,
        'sonar-scanner',
      );

      expect(spawn).toHaveBeenCalledTimes(1);
      const [command, args, options] = (spawn as jest.Mock).mock.calls.pop();
      expect(command).toBe('sonar-scanner');
      expect(args).toEqual(['-Xmx512m']);
      expect(options.env.SONARQUBE_SCANNER_PARAMS).toBe(JSON.stringify(MOCK_PROPERTIES));
    });

    it('should display SonarScanner CLI output', async () => {
      childProcessHandler.setOutput('the output', 'some error');

      await runScannerCli({}, MOCK_PROPERTIES, 'sonar-scanner');

      expect(log).toHaveBeenCalledWith(LogLevel.ERROR, 'some error');
      expect(log).toHaveBeenCalledWith(LogLevel.INFO, 'the output');
    });

    it('should reject if SonarScanner CLI fails', async () => {
      childProcessHandler.setExitCode(1);

      await expect(runScannerCli({}, MOCK_PROPERTIES, 'sonar-scanner')).rejects.toBeDefined();

      expect(log).toHaveBeenCalledWith(LogLevel.ERROR, 'SonarScanner CLI failed with code 1');
    });

    it('should pass proxy options to scanner', async () => {
      await runScannerCli(
        {},
        {
          ...MOCK_PROPERTIES,
          [ScannerProperty.SonarScannerProxyHost]: 'proxy',
          [ScannerProperty.SonarScannerProxyPort]: '9000',
          [ScannerProperty.SonarScannerProxyUser]: 'some-user',
          [ScannerProperty.SonarScannerProxyPassword]: 'password',
        },
        'sonar-scanner',
      );

      expect(spawn).toHaveBeenCalledTimes(1);
      const [command, args, options] = (spawn as jest.Mock).mock.calls.pop();
      expect(command).toBe('sonar-scanner');
      expect(args).toEqual([
        '-Dhttp.proxyHost=proxy',
        '-Dhttp.proxyPort=9000',
        '-Dhttp.proxyUser=some-user',
        '-Dhttp.proxyPassword=password',
      ]);
      expect(options.env.SONARQUBE_SCANNER_PARAMS).toBe(
        JSON.stringify({
          ...MOCK_PROPERTIES,
          [ScannerProperty.SonarScannerProxyHost]: 'proxy',
          [ScannerProperty.SonarScannerProxyPort]: '9000',
          [ScannerProperty.SonarScannerProxyUser]: 'some-user',
          [ScannerProperty.SonarScannerProxyPassword]: 'password',
        }),
      );
    });

    it('should pass https proxy options to scanner', async () => {
      await runScannerCli(
        {},
        {
          [ScannerProperty.SonarToken]: 'token',
          [ScannerProperty.SonarHostUrl]: 'https://localhost:9000',
          [ScannerProperty.SonarScannerProxyHost]: 'proxy',
          [ScannerProperty.SonarScannerProxyPort]: '9000',
          [ScannerProperty.SonarScannerProxyUser]: 'some-user',
          [ScannerProperty.SonarScannerProxyPassword]: 'password',
        },
        'sonar-scanner',
      );

      expect(spawn).toHaveBeenCalledTimes(1);
      const [command, args, options] = (spawn as jest.Mock).mock.calls.pop();
      expect(command).toBe('sonar-scanner');
      expect(args).toEqual([
        '-Dhttps.proxyHost=proxy',
        '-Dhttps.proxyPort=9000',
        '-Dhttps.proxyUser=some-user',
        '-Dhttps.proxyPassword=password',
      ]);
      expect(options.env.SONARQUBE_SCANNER_PARAMS).toBe(
        JSON.stringify({
          [ScannerProperty.SonarToken]: 'token',
          [ScannerProperty.SonarHostUrl]: 'https://localhost:9000',
          [ScannerProperty.SonarScannerProxyHost]: 'proxy',
          [ScannerProperty.SonarScannerProxyPort]: '9000',
          [ScannerProperty.SonarScannerProxyUser]: 'some-user',
          [ScannerProperty.SonarScannerProxyPassword]: 'password',
        }),
      );
    });
  });

  describe('normalizePlatformName', function () {
    it('detect Windows', function () {
      const stub = sinon.stub(process, 'platform').value('windows10');

      expect(normalizePlatformName()).toEqual('windows');
      stub.restore();
    });

    it('detect Mac', function () {
      const stub = sinon.stub(process, 'platform').value('darwin');

      expect(normalizePlatformName()).toEqual('macosx');
      stub.restore();
    });

    it('detect Linux', function () {
      const stub = sinon.stub(process, 'platform').value('linux');

      expect(normalizePlatformName()).toEqual('linux');
      stub.restore();
    });

    it('throw if something else', function () {
      const stub = sinon.stub(process, 'platform').value('non-existing-os');

      expect(normalizePlatformName).toThrow(
        new Error(`Your platform 'non-existing-os' is currently not supported.`),
      );
      stub.restore();
    });
  });
});