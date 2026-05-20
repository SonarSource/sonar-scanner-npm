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
    log(LogLevel.INFO, `Local install of SonarScanner CLI (${executable}) not found: ${error}`);
    return null;
  }
}
