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
import { ScanOptions } from './types';

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
