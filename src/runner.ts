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

import { scan } from './scan';
import { program } from 'commander';

program
  .option('-D, --define <property=value...>', 'Define property')
  .version('__VERSION__', '-v, --version', 'Display version information')
  .option('-X, --debug', 'Produce execution debug output');

export function parseArgs() {
  return program.parse().opts();
}

scan({}, parseArgs()).catch(() => {
  process.exitCode = 1;
});
