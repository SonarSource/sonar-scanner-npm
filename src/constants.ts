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
import { ScannerProperty } from './types';

export const SCANNER_BOOTSTRAPPER_NAME = 'ScannerNpm';

export const SONARCLOUD_URL = 'https://sonarcloud.io';

export const SONARCLOUD_API_BASE_URL = 'https://api.sonarcloud.io';

export const SONARCLOUD_URL_REGEX = /^(https?:\/\/)?(www\.)?(sonarcloud\.io)/;

export const SONARQUBE_JRE_PROVISIONING_MIN_VERSION = '10.6';

export const SONAR_DIR_DEFAULT = '.sonar';

export const SONAR_CACHE_DIR = 'cache';

export const UNARCHIVE_SUFFIX = '_extracted';

export const SONAR_SCANNER_ALIAS = 'SonarScanner Engine';
export const JRE_ALIAS = 'JRE';

export const ENV_VAR_PREFIX = 'SONAR_SCANNER_';
export const NPM_CONFIG_ENV_VAR_PREFIX = 'npm_config_sonar_scanner_';

export const ENV_TO_PROPERTY_NAME: [string, ScannerProperty][] = [
  ['SONAR_BINARY_CACHE', ScannerProperty.SonarUserHome], // old deprecated format
  ['SONAR_TOKEN', ScannerProperty.SonarToken],
  ['SONAR_HOST_URL', ScannerProperty.SonarHostUrl],
  ['SONAR_USER_HOME', ScannerProperty.SonarUserHome],
  ['SONAR_ORGANIZATION', ScannerProperty.SonarOrganization],
];

export const SONAR_PROJECT_FILENAME = 'sonar-project.properties';

export const DEFAULT_SONAR_EXCLUSIONS =
  'node_modules/**,bower_components/**,jspm_packages/**,typings/**,lib-cov/**';

export const API_V2_VERSION_ENDPOINT = '/analysis/version';
export const API_V2_JRE_ENDPOINT = '/analysis/jres';
export const API_V2_SCANNER_ENGINE_ENDPOINT = '/analysis/engine';

export const API_OLD_VERSION_ENDPOINT = '/api/server/version';

export const SCANNER_CLI_DEFAULT_BIN_NAME = 'sonar-scanner';
export const SCANNER_CLI_VERSION = '6.0.0.4432';
export const SCANNER_CLI_MIRROR =
  'https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/';
export const SCANNER_CLI_INSTALL_PATH = 'native-sonar-scanner';

export const WINDOWS_WHERE_EXE_PATH = 'C:\\Windows\\System32\\where.exe';

export const SCANNER_DEPRECATED_PROPERTIES: ScannerProperty[][] = [
  [ScannerProperty.SonarWsTimeout, ScannerProperty.SonarScannerResponseTimeout],
  [ScannerProperty.HttpProxyHost, ScannerProperty.SonarScannerProxyHost],
  [ScannerProperty.HttpProxyPort, ScannerProperty.SonarScannerProxyPort],
  [ScannerProperty.HttpProxyUser, ScannerProperty.SonarScannerProxyUser],
  [ScannerProperty.HttpProxyPassword, ScannerProperty.SonarScannerProxyPassword],
  [ScannerProperty.SonarLogin, ScannerProperty.SonarToken],
];
