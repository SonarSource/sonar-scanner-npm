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

import fs from 'fs';
import sinon from 'sinon';
import { log, LogLevel } from '../../src/logging';
import * as platform from '../../src/platform';

describe('getPlatformInfo', () => {
  it('detect macos', () => {
    const platformStub = sinon.stub(process, 'platform').value('darwin');
    const archStub = sinon.stub(process, 'arch').value('arm64');

    expect(platform.getSupportedOS()).toEqual('darwin');
    expect(platform.getArch()).toEqual('arm64');

    platformStub.restore();
    archStub.restore();
  });

  it('detect windows', () => {
    const platformStub = sinon.stub(process, 'platform').value('win32');
    const archStub = sinon.stub(process, 'arch').value('x64');

    expect(platform.getSupportedOS()).toEqual('win32');
    expect(platform.getArch()).toEqual('x64');

    platformStub.restore();
    archStub.restore();
  });

  it('detect linux flavor', () => {
    const platformStub = sinon.stub(process, 'platform').value('openbsd');
    const archStub = sinon.stub(process, 'arch').value('x64');

    expect(platform.getSupportedOS()).toEqual('openbsd');
    expect(platform.getArch()).toEqual('x64');

    platformStub.restore();
    archStub.restore();
  });

  it('detect alpine', () => {
    const platformStub = sinon.stub(process, 'platform').value('linux');
    const archStub = sinon.stub(process, 'arch').value('x64');
    const fsReadStub = sinon.stub(fs, 'readFileSync');
    fsReadStub.withArgs('/etc/os-release').returns('NAME="Alpine Linux"\nID=alpine');

    expect(platform.getSupportedOS()).toEqual('alpine');
    expect(platform.getArch()).toEqual('x64');

    platformStub.restore();
    archStub.restore();
    fsReadStub.restore();
  });

  it('detect alpine with fallback', () => {
    const platformStub = sinon.stub(process, 'platform').value('linux');
    const archStub = sinon.stub(process, 'arch').value('x64');
    const fsReadStub = sinon.stub(fs, 'readFileSync');
    fsReadStub.withArgs('/usr/lib/os-release').returns('NAME="Alpine Linux"\nID=alpine');

    expect(platform.getSupportedOS()).toEqual('alpine');
    expect(platform.getArch()).toEqual('x64');

    platformStub.restore();
    archStub.restore();
    fsReadStub.restore();
  });

  it('failed to detect alpine', () => {
    const platformStub = sinon.stub(process, 'platform').value('linux');
    const archStub = sinon.stub(process, 'arch').value('x64');
    const fsReadStub = sinon.stub(fs, 'readFileSync');

    expect(platform.getSupportedOS()).toEqual('linux');
    expect(platform.getArch()).toEqual('x64');

    expect(log).toHaveBeenCalledWith(
      LogLevel.WARN,
      'Failed to read /etc/os-release or /usr/lib/os-release',
    );

    platformStub.restore();
    archStub.restore();
    fsReadStub.restore();
  });
});
