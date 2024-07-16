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

// logging is globally mocked, but in this case the true log output is needed
jest.mock('../../src/logging', () => ({
  ...jest.requireActual('../../src/logging'),
  log: jest.fn(),
}));

import * as java from '../../src/java';
import * as logging from '../../src/logging';
import * as platform from '../../src/platform';
import * as sonarProcess from '../../src/process';
import { scan } from '../../src/scan';
import * as scannerCli from '../../src/scanner-cli';
import * as scannerEngine from '../../src/scanner-engine';
import { ScannerProperty } from '../../src/types';

jest.mock('../../src/java');
jest.mock('../../src/scanner-cli');
jest.mock('../../src/process');
jest.mock('../../src/scanner-engine');
jest.mock('../../src/platform');
jest.mock('../../package.json', () => ({
  version: 'MOCK.VERSION',
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('scan', () => {
  it('should default the log level to INFO', async () => {
    await scan({});
    expect(logging.getLogLevel()).toBe('INFO');
  });

  it('should set the log level to the value provided by the user', async () => {
    await scan({ options: { 'sonar.verbose': 'true' } });
    expect(logging.getLogLevel()).toBe('DEBUG');
  });

  it('should set the log level to the value provided by the user', async () => {
    await scan({ options: { 'sonar.log.level': 'DEBUG' } });
    expect(logging.getLogLevel()).toBe('DEBUG');
  });

  it('should output the current version of the scanner', async () => {
    jest.spyOn(java, 'serverSupportsJREProvisioning').mockResolvedValue(false);
    await scan({});
    expect(logging.log).toHaveBeenCalledWith('INFO', 'Version: MOCK.VERSION');
  });

  it('should output the current platform', async () => {
    jest.spyOn(java, 'serverSupportsJREProvisioning').mockResolvedValue(false);
    jest.spyOn(platform, 'getSupportedOS').mockReturnValue('alpine');
    jest.spyOn(platform, 'getArch').mockReturnValue('arm64');
    await scan({});
    expect(logging.log).toHaveBeenCalledWith('INFO', 'Platform:', 'alpine', 'arm64');
  });

  describe('when server does not support JRE provisioning', () => {
    it('should download and run SonarScanner CLI', async () => {
      jest.spyOn(java, 'serverSupportsJREProvisioning').mockResolvedValue(false);
      jest.spyOn(scannerEngine, 'runScannerEngine');
      jest.spyOn(scannerCli, 'downloadScannerCli').mockResolvedValue('/path/to/scanner-cli');
      jest.spyOn(scannerCli, 'runScannerCli');

      await scan({ serverUrl: 'http://localhost:9000' });

      expect(java.fetchJRE).not.toHaveBeenCalled();
      expect(scannerEngine.runScannerEngine).not.toHaveBeenCalled();
      expect(scannerCli.runScannerCli).toHaveBeenCalled();
      const [, , scannerPath] = (scannerCli.runScannerCli as jest.Mock).mock.calls.pop();
      expect(scannerPath).toBe('/path/to/scanner-cli');
    });

    it('should use local scanner if requested', async () => {
      jest.spyOn(java, 'serverSupportsJREProvisioning').mockResolvedValue(false);
      jest.spyOn(scannerEngine, 'runScannerEngine');
      jest.spyOn(scannerCli, 'runScannerCli');
      jest.spyOn(sonarProcess, 'locateExecutableFromPath').mockResolvedValue('/bin/sonar-scanner');

      await scan({ serverUrl: 'http://localhost:9000', localScannerCli: true });

      expect(scannerCli.downloadScannerCli).not.toHaveBeenCalled();
      expect(scannerCli.runScannerCli).toHaveBeenCalled();
      const [, , scannerPath] = (scannerCli.runScannerCli as jest.Mock).mock.calls.pop();
      expect(scannerPath).toBe('/bin/sonar-scanner');
    });

    it('should fail if local scanner is requested but not found', async () => {
      jest.spyOn(process, 'exit').mockImplementation();
      jest.spyOn(java, 'serverSupportsJREProvisioning').mockResolvedValue(false);
      jest.spyOn(scannerEngine, 'runScannerEngine');
      jest.spyOn(scannerCli, 'runScannerCli');
      jest.spyOn(sonarProcess, 'locateExecutableFromPath').mockResolvedValue(null);

      await scan({ serverUrl: 'http://localhost:9000', localScannerCli: true });

      expect(scannerCli.downloadScannerCli).not.toHaveBeenCalled();
      expect(scannerCli.runScannerCli).not.toHaveBeenCalled();
      expect(logging.log).toHaveBeenCalledWith(
        logging.LogLevel.ERROR,
        expect.stringMatching(/SonarScanner CLI not found in PATH/),
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('when server supports provisioning', () => {
    it('should fetch the JRE', async () => {
      jest.spyOn(java, 'serverSupportsJREProvisioning').mockResolvedValue(true);
      jest.spyOn(java, 'fetchJRE').mockResolvedValue('/some-provisioned-jre');
      jest.spyOn(scannerEngine, 'runScannerEngine');

      await scan({ serverUrl: 'http://localhost:9000' });

      expect(java.fetchJRE).toHaveBeenCalled();
      const [javaPath] = (scannerEngine.runScannerEngine as jest.Mock).mock.calls.pop();
      expect(javaPath).toBe('/some-provisioned-jre');
    });

    it('should not fetch the JRE if the JRE path is explicitly specified', async () => {
      jest.spyOn(java, 'serverSupportsJREProvisioning').mockResolvedValue(true);
      jest.spyOn(java, 'fetchJRE');
      jest.spyOn(scannerEngine, 'runScannerEngine');

      await scan({
        serverUrl: 'http://localhost:9000',
        options: { [ScannerProperty.SonarScannerJavaExePath]: 'path/to/java' },
      });

      expect(java.fetchJRE).not.toHaveBeenCalled();
      const [javaPath] = (scannerEngine.runScannerEngine as jest.Mock).mock.calls.pop();
      expect(javaPath).toBe('path/to/java');
    });

    it('should not fetch the JRE if skipping JRE provisioning explicitly', async () => {
      jest.spyOn(java, 'serverSupportsJREProvisioning').mockResolvedValue(true);
      jest.spyOn(java, 'fetchJRE');
      jest.spyOn(scannerEngine, 'runScannerEngine');
      jest.spyOn(sonarProcess, 'locateExecutableFromPath').mockResolvedValue('/usr/bin/java');

      await scan({
        serverUrl: 'http://localhost:9000',
        options: {
          [ScannerProperty.SonarScannerSkipJreProvisioning]: 'true',
        },
      });

      expect(java.fetchJRE).not.toHaveBeenCalled();
      expect(sonarProcess.locateExecutableFromPath).toHaveBeenCalled();
      const [javaPath] = (scannerEngine.runScannerEngine as jest.Mock).mock.calls.pop();
      expect(javaPath).toBe('/usr/bin/java');
    });

    it('should fail when skipping JRE provisioning without java in PATH', async () => {
      jest.spyOn(process, 'exit').mockImplementation();
      jest.spyOn(java, 'serverSupportsJREProvisioning').mockResolvedValue(true);
      jest.spyOn(java, 'fetchJRE');
      jest.spyOn(scannerEngine, 'runScannerEngine');
      jest.spyOn(sonarProcess, 'locateExecutableFromPath').mockResolvedValue(null);

      await scan({
        serverUrl: 'http://localhost:9000',
        options: {
          [ScannerProperty.SonarScannerSkipJreProvisioning]: 'true',
        },
      });

      expect(scannerEngine.runScannerEngine).not.toHaveBeenCalled();
      expect(scannerCli.runScannerCli).not.toHaveBeenCalled();
      expect(logging.log).toHaveBeenCalledWith(
        logging.LogLevel.ERROR,
        expect.stringMatching(/Java not found in PATH/),
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});
