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

import { createRequire } from 'node:module';

// Load package.json from the current package root. JSON import attributes are not available
// on all supported Node 22 versions, so use createRequire from ESM.
const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version?: string };

const packageVersion = packageJson.version;

if (!packageVersion) {
  throw new Error('Version not found in package.json. This indicates a build error.');
}

export const version: string = packageVersion;
