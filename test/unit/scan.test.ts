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

import * as java from '../../src/java';
import * as logging from '../../src/logging';
import * as platform from '../../src/platform';
import { scan } from '../../src/scan';

jest.mock('../../src/java');
jest.mock('../../src/platform');
jest.mock('../../package.json', () => ({
  version: 'MOCK.VERSION',
}));

jest.spyOn(logging, 'setLogLevel');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('scan', () => {
  it('should default the log level to INFO', async () => {
    await scan({}, []);
    expect(logging.getLogLevel()).toBe('INFO');
  });

  it('should set the log level to the value provided by the user', async () => {
    await scan({ options: { 'sonar.verbose': 'true' } }, []);
    expect(logging.getLogLevel()).toBe('DEBUG');
  });

  it('should output the current version of the scanner', async () => {
    (java.serverSupportsJREProvisioning as jest.Mock).mockResolvedValue(false);
    jest.spyOn(logging, 'log');
    await scan({}, []);
    expect(logging.log).toHaveBeenCalledWith('INFO', 'Version: ', 'MOCK.VERSION');
  });

  it('should output the current platform', async () => {
    (java.serverSupportsJREProvisioning as jest.Mock).mockResolvedValue(false);
    jest.spyOn(logging, 'log');
    jest.spyOn(platform, 'getPlatformInfo').mockReturnValue({ os: 'alpine', arch: 'arm64' });
    await scan({}, []);
    expect(logging.log).toHaveBeenCalledWith('INFO', 'Platform: ', {
      os: 'alpine',
      arch: 'arm64',
    });
  });

  describe('when the SQ version does not support JRE provisioning', () => {
    it('should not fetch the JRE version', async () => {
      (java.serverSupportsJREProvisioning as jest.Mock).mockResolvedValue(false);
      await scan({}, []);
      expect(java.handleJREProvisioning).not.toHaveBeenCalled();
    });
  });

  describe('when the user provides a JRE exe path override', () => {
    it('should not fetch the JRE version', async () => {
      (java.serverSupportsJREProvisioning as jest.Mock).mockResolvedValue(false);
      await scan({ options: { 'sonar.scanner.javaExePath': 'path/to/java' } }, []);
      expect(java.handleJREProvisioning).not.toHaveBeenCalled();

      // TODO: test that the JRE exe path is used when running the scanner engine
    });
  });

  describe('when the user provides a SonarQube URL and the version supports provisioning', () => {
    it('should fetch the JRE version', async () => {
      (java.serverSupportsJREProvisioning as jest.Mock).mockResolvedValue(true);
      jest.spyOn(java, 'handleJREProvisioning');
      await scan({ serverUrl: 'http://localhost:9000' }, []);
      expect(java.handleJREProvisioning).toHaveBeenCalled();
    });
  });
});
