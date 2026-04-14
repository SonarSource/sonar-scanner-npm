/*
 * sonar-scanner-npm
 * Copyright (C) SonarSource Sàrl
 * mailto:info AT sonarsource DOT com
 *
 * You can redistribute and/or modify this program under the terms of
 * the Sonar Source-Available License Version 1, as published by SonarSource Sàrl.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the Sonar Source-Available License for more details.
 *
 * You should have received a copy of the Sonar Source-Available License
 * along with this program; if not, see https://sonarsource.com/license/ssal/
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
  const { fs } = getDeps();
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
