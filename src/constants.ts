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
import path from 'path';

export const SCANNER_BOOTSTRAPPER_NAME = 'ScannerNpm';

export const SONARCLOUD_ENV_REGEX =
  /^(https?:\/\/)?(www\.)?([a-zA-Z0-9-]+\.)?(sc-dev\.io|sc-staging\.io|sonarcloud\.io)/;

export const SONARQUBE_JRE_PROVISIONING_MIN_VERSION = '10.6';

export const SONAR_CACHE_DIR = path.join(
  process.env.HOME ?? process.env.USERPROFILE ?? '',
  '.sonar',
  'cache',
);

export const UNARCHIVE_SUFFIX = '_extracted';
