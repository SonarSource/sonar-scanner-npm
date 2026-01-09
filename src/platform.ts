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

import fs from 'node:fs';
import { LogLevel, log } from './logging';

export interface PlatformProcessDeps {
  platform: NodeJS.Platform;
  arch: NodeJS.Architecture;
}

export interface PlatformFsDeps {
  readFileSync: typeof fs.readFileSync;
}

const defaultProcessDeps: PlatformProcessDeps = {
  get platform() {
    return process.platform;
  },
  get arch() {
    return process.arch;
  },
};

const defaultFsDeps: PlatformFsDeps = {
  readFileSync: fs.readFileSync,
};

export function getArch(
  processDeps: PlatformProcessDeps = defaultProcessDeps,
): NodeJS.Architecture {
  return processDeps.arch;
}

export function isLinux(processDeps: PlatformProcessDeps = defaultProcessDeps): boolean {
  return processDeps.platform === 'linux';
}

export function isWindows(processDeps: PlatformProcessDeps = defaultProcessDeps) {
  return processDeps.platform === 'win32';
}

export function isMac(processDeps: PlatformProcessDeps = defaultProcessDeps) {
  return processDeps.platform === 'darwin';
}

/**
 * @see https://github.com/microsoft/vscode/blob/64874113ad3c59e8d045f75dc2ef9d33d13f3a03/src/vs/platform/extensionManagement/common/extensionManagementUtil.ts#L171C1-L190C1
 */

function isAlpineLinux(
  processDeps: PlatformProcessDeps = defaultProcessDeps,
  fsDeps: PlatformFsDeps = defaultFsDeps,
): boolean {
  if (!isLinux(processDeps)) {
    return false;
  }
  let content: string | undefined;
  try {
    const fileContent = fsDeps.readFileSync('/etc/os-release');
    content = fileContent.toString();
  } catch (error) {
    try {
      const fileContent = fsDeps.readFileSync('/usr/lib/os-release');
      content = fileContent.toString();
    } catch (error) {
      log(LogLevel.WARN, 'Failed to read /etc/os-release or /usr/lib/os-release');
    }
  }
  const match = /^ID=([^\r\n]*)/m.exec(content ?? '');
  return !!content && (match ? match[1] === 'alpine' : false);
}

export function getSupportedOS(
  processDeps: PlatformProcessDeps = defaultProcessDeps,
  fsDeps: PlatformFsDeps = defaultFsDeps,
): NodeJS.Platform | 'alpine' {
  return isAlpineLinux(processDeps, fsDeps) ? 'alpine' : processDeps.platform;
}
