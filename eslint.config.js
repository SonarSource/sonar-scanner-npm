import { defineConfig, globalIgnores } from 'eslint/config';

import tsParser from '@typescript-eslint/parser';
import sonarjs from 'eslint-plugin-sonarjs';

const licenseHeader = `/*
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
 */`;

export default defineConfig([
  {
    files: ['**/*.ts', '**/*.js'],
    languageOptions: {
      parser: tsParser,
    },

    plugins: {
      sonarjs,
    },

    rules: {
      'sonarjs/file-header': [
        'error',
        {
          headerFormat: licenseHeader,
        },
      ],
    },
  },
  globalIgnores([
    '**/dist',
    '**/build',
    '**/coverage/**',
    'eslint.config.js',
    '**/fixtures',
    'bin/**',
  ]),
]);
