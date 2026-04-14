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

import { scan } from './scan';
import { program } from 'commander';
import { version } from './version';

program
  .option('-D, --define <property=value...>', 'Define property')
  .version(version, '-v, --version', 'Display version information')
  .option('-X, --debug', 'Produce execution debug output');

function parseArgs() {
  return program.parse().opts();
}

scan({}, parseArgs()).catch(() => {
  process.exitCode = 1;
});
