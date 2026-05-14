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
import { ScannerProperty } from './types';

export const SCANNER_BOOTSTRAPPER_NAME = 'ScannerNpm';

export const SONARCLOUD_URL = 'https://sonarcloud.io';
export const SONARCLOUD_URL_US = 'https://sonarqube.us';

export const SONARCLOUD_API_BASE_URL = 'https://api.sonarcloud.io';
export const SONARCLOUD_API_BASE_URL_US = 'https://api.sonarqube.us';

export const SONARCLOUD_URL_REGEX = /^(https?:\/\/)?(www\.)?(sonarcloud\.io)/;
export const SONARCLOUD_US_URL_REGEX = /^(https?:\/\/)?(www\.)?(sonarqube\.us)/;

export const REGION_US = 'us';
export const REGIONS = [REGION_US];

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
export const SCANNER_CLI_VERSION = '6.2.1.4610';
export const SCANNER_CLI_MIRROR =
  'https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/';
export const SCANNER_CLI_INSTALL_PATH = 'native-sonar-scanner';

export const WINDOWS_WHERE_EXE_PATH = String.raw`C:\Windows\System32\where.exe`;

export const SCANNER_DEPRECATED_PROPERTIES: ScannerProperty[][] = [
  [ScannerProperty.SonarWsTimeout, ScannerProperty.SonarScannerResponseTimeout],
  [ScannerProperty.HttpProxyHost, ScannerProperty.SonarScannerProxyHost],
  [ScannerProperty.HttpProxyPort, ScannerProperty.SonarScannerProxyPort],
  [ScannerProperty.HttpProxyUser, ScannerProperty.SonarScannerProxyUser],
  [ScannerProperty.HttpProxyPassword, ScannerProperty.SonarScannerProxyPassword],
  [ScannerProperty.SonarLogin, ScannerProperty.SonarToken],
];
