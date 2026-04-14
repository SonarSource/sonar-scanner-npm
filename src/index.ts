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
import type { ScanOptions } from './types';

export { scan };

export function customScanner(scanOptions: ScanOptions) {
  return scan({
    ...scanOptions,
    localScannerCli: true,
  });
}

function scanWithCallback(scanOptions: ScanOptions, callback: (error?: unknown) => void) {
  return scan(scanOptions)
    .then(() => {
      callback();
    })
    .catch(error => {
      callback(error);
    });
}

export default scanWithCallback;
