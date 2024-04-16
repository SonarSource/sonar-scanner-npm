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

import * as platform from '../../src/platform';
import * as logging from '../../src/logging';
import fs from 'fs';
import sinon from 'sinon';

describe('getPlatformInfo', () => {
  it('detect macos', () => {
    const platformStub = sinon.stub(process, 'platform').value('darwin');
    const archStub = sinon.stub(process, 'arch').value('arm64');

    expect(platform.getPlatformInfo()).toEqual({
      os: 'darwin',
      arch: 'arm64',
    });

    platformStub.restore();
    archStub.restore();
  });

  it('detect windows', () => {
    const platformStub = sinon.stub(process, 'platform').value('win32');
    const archStub = sinon.stub(process, 'arch').value('x64');

    expect(platform.getPlatformInfo()).toEqual({
      os: 'win32',
      arch: 'x64',
    });

    platformStub.restore();
    archStub.restore();
  });

  it('detect linux flavor', () => {
    const platformStub = sinon.stub(process, 'platform').value('openbsd');
    const archStub = sinon.stub(process, 'arch').value('x64');

    expect(platform.getPlatformInfo()).toEqual({
      os: 'openbsd',
      arch: 'x64',
    });

    platformStub.restore();
    archStub.restore();
  });

  it('detect alpine', () => {
    const platformStub = sinon.stub(process, 'platform').value('linux');
    const archStub = sinon.stub(process, 'arch').value('x64');
    const fsReadStub = sinon.stub(fs, 'readFileSync');
    fsReadStub.withArgs('/etc/os-release').returns('NAME="Alpine Linux"\nID=alpine');

    expect(platform.getPlatformInfo()).toEqual({
      os: 'alpine',
      arch: 'x64',
    });

    platformStub.restore();
    archStub.restore();
    fsReadStub.restore();
  });

  it('detect alpine with fallback', () => {
    const platformStub = sinon.stub(process, 'platform').value('linux');
    const archStub = sinon.stub(process, 'arch').value('x64');
    const fsReadStub = sinon.stub(fs, 'readFileSync');
    fsReadStub.withArgs('/usr/lib/os-release').returns('NAME="Alpine Linux"\nID=alpine');

    expect(platform.getPlatformInfo()).toEqual({
      os: 'alpine',
      arch: 'x64',
    });

    platformStub.restore();
    archStub.restore();
    fsReadStub.restore();
  });

  it('failed to detect alpine', () => {
    const logSpy = sinon.spy(logging, 'log');
    const platformStub = sinon.stub(process, 'platform').value('linux');
    const archStub = sinon.stub(process, 'arch').value('x64');

    expect(platform.getPlatformInfo()).toEqual({
      os: 'linux',
      arch: 'x64',
    });

    expect(
      logSpy.calledWith(
        logging.LogLevel.ERROR,
        'Failed to read /etc/os-release or /usr/lib/os-release',
      ),
    ).toBe(true);

    platformStub.restore();
    archStub.restore();
    logSpy.restore();
  });
});
