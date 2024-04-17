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
import { ScannerProperty } from './types';

export const SCANNER_BOOTSTRAPPER_NAME = 'ScannerNpm';

export const SONARCLOUD_URL = 'https://sonarcloud.io';

export const SONARCLOUD_URL_REGEX = /^(https?:\/\/)?(www\.)?(sonarcloud\.io)/;

export const SONARCLOUD_ENV_REGEX =
  /^(https?:\/\/)?(www\.)?([a-zA-Z0-9-]+\.)?(sc-dev\.io|sc-staging\.io|sonarcloud\.io)/;

export const SONARCLOUD_PRODUCTION_URL = 'https://sonarcloud.io';

export const SONARQUBE_JRE_PROVISIONING_MIN_VERSION = '10.6';

export const SONAR_CACHE_DIR = path.join(
  process.env.HOME ?? process.env.USERPROFILE ?? '',
  '.sonar',
  'cache',
);

export const UNARCHIVE_SUFFIX = '_extracted';

export const ENV_VAR_PREFIX = 'SONAR_SCANNER_';

export const ENV_TO_PROPERTY_NAME: [string, ScannerProperty][] = [
  ['SONAR_TOKEN', ScannerProperty.SonarToken],
  ['SONAR_HOST_URL', ScannerProperty.SonarHostUrl],
  ['SONAR_USER_HOME', ScannerProperty.SonarUserHome],
  ['SONAR_ORGANIZATION', ScannerProperty.SonarOrganization],
];

export const SONAR_PROJECT_FILENAME = 'sonar-project.properties';

export const DEFAULT_SONAR_EXCLUSIONS =
  'node_modules/**,bower_components/**,jspm_packages/**,typings/**,lib-cov/**';

export const API_V2_VERSION_ENDPOINT = '/api/v2/analysis/version';
export const API_OLD_VERSION_ENDPOINT = '/api/server/version';
export const API_V2_JRE_ENDPOINT = '/api/v2/analysis/jres';
