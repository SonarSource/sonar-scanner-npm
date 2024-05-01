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
import { LogLevel, log } from './logging';

export function getArch(): NodeJS.Architecture {
  return process.arch;
}

export function isLinux(): boolean {
  return process.platform === 'linux';
}

export function isWindows() {
  return process.platform === 'win32';
}

export function isMac() {
  return process.platform === 'darwin';
}

/**
 * @see https://github.com/microsoft/vscode/blob/64874113ad3c59e8d045f75dc2ef9d33d13f3a03/src/vs/platform/extensionManagement/common/extensionManagementUtil.ts#L171C1-L190C1
 */

function isAlpineLinux(): boolean {
  if (!isLinux()) {
    return false;
  }
  let content: string | undefined;
  try {
    const fileContent = fs.readFileSync('/etc/os-release');
    content = fileContent.toString();
  } catch (error) {
    try {
      const fileContent = fs.readFileSync('/usr/lib/os-release');
      content = fileContent.toString();
    } catch (error) {
      log(LogLevel.WARN, 'Failed to read /etc/os-release or /usr/lib/os-release');
    }
  }
  return !!content && (content.match(/^ID=([^\u001b\r\n]*)/m) || [])[1] === 'alpine';
}

export function getSupportedOS(): NodeJS.Platform | 'alpine' {
  return isAlpineLinux() ? 'alpine' : process.platform;
}
