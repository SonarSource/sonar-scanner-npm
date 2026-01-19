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

import { WINDOWS_WHERE_EXE_PATH } from './constants';
import { getDeps } from './deps';
import { log, LogLevel } from './logging';
import { isWindows } from './platform';

/**
 * Verify that a given executable is accessible from the PATH.
 * We use where.exe on Windows to check for the existence of the command to avoid
 * search path vulnerabilities. Otherwise, Windows would search the current directory
 * for the executable.
 */
export async function locateExecutableFromPath(executable: string): Promise<string | null> {
  const { execAsync } = getDeps();
  try {
    log(LogLevel.INFO, `Trying to find ${executable}`);
    const child = await execAsync(
      `${isWindows() ? WINDOWS_WHERE_EXE_PATH : 'which'} ${executable}`,
    );
    const stdout = child.stdout?.trim();
    if (stdout.length) {
      return stdout;
    }
    log(LogLevel.INFO, 'Local install of SonarScanner CLI found.');
    return null;
  } catch (error) {
    log(LogLevel.INFO, `Local install of SonarScanner CLI (${executable}) not found`);
    return null;
  }
}
