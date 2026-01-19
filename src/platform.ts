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

import { getDeps } from './deps';
import { LogLevel, log } from './logging';

export function getArch(): NodeJS.Architecture {
  const { process } = getDeps();
  return process.arch;
}

export function isLinux(): boolean {
  const { process } = getDeps();
  return process.platform === 'linux';
}

export function isWindows() {
  const { process } = getDeps();
  return process.platform === 'win32';
}

export function isMac() {
  const { process } = getDeps();
  return process.platform === 'darwin';
}

/**
 * @see https://github.com/microsoft/vscode/blob/64874113ad3c59e8d045f75dc2ef9d33d13f3a03/src/vs/platform/extensionManagement/common/extensionManagementUtil.ts#L171C1-L190C1
 */

function isAlpineLinux(): boolean {
  const { process, fs } = getDeps();
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
  const match = /^ID=([^\r\n]*)/m.exec(content ?? '');
  return !!content && (match ? match[1] === 'alpine' : false);
}

export function getSupportedOS(): NodeJS.Platform | 'alpine' {
  const { process } = getDeps();
  return isAlpineLinux() ? 'alpine' : process.platform;
}
