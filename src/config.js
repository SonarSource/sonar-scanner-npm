/*
 * sonar-scanner-npm
 * Copyright (C) 2022-2023 SonarSource SA
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

const sonarScannerParams = require('./sonar-scanner-params');
const { findTargetOS, buildInstallFolderPath, buildExecutablePath } = require('./utils');
const os = require('os');
const fs = require('fs');
const log = require('fancy-log');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { isWindows } = require('./utils/platform');

module.exports.getScannerParams = getScannerParams;
module.exports.extendWithExecParams = extendWithExecParams;
module.exports.getExecutableParams = getExecutableParams;

const DEFAULT_EXCLUSIONS =
  'node_modules/**,bower_components/**,jspm_packages/**,typings/**,lib-cov/**';
module.exports.DEFAULT_EXCLUSIONS = DEFAULT_EXCLUSIONS;
const DEFAULT_SCANNER_VERSION = '5.0.1.3006';
module.exports.DEFAULT_SCANNER_VERSION = DEFAULT_SCANNER_VERSION;
const SONAR_SCANNER_MIRROR = 'https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/';
module.exports.SONAR_SCANNER_MIRROR = SONAR_SCANNER_MIRROR;

/**
 * Build the SONARQUBE_SCANNER_PARAMS which will be passed as an environment
 * variable to the scanner.
 *
 * @returns
 */
function getScannerParams(basePath, params = {}) {
  const config = {};

  const sqScannerParams = sonarScannerParams(
    params,
    basePath,
    process.env.hasOwnProperty('SONARQUBE_SCANNER_PARAMS') && process.env.SONARQUBE_SCANNER_PARAMS,
  );

  // We need to merge the existing env variables (process.env) with the SQ ones
  if (sqScannerParams) {
    config.SONARQUBE_SCANNER_PARAMS = sqScannerParams;
  }

  return config;
}

/**
 * Gather the parameters for sonar-scanner-executable:
 *  - installFolder
 *  - platformExecutable
 *  - downloadUrl
 *  - fileName
 *  - httpOptions, if proxy
 */
function getExecutableParams(params = {}) {
  const config = {
    httpOptions: {},
  };

  const env = process.env;

  let platformBinariesVersion = DEFAULT_SCANNER_VERSION;

  if (params.hasOwnProperty('version')) {
    platformBinariesVersion = params.version;
  } else if (env.hasOwnProperty('SONAR_SCANNER_VERSION')) {
    platformBinariesVersion = env.SONAR_SCANNER_VERSION;
  } else if (env.hasOwnProperty('npm_config_sonar_scanner_version')) {
    platformBinariesVersion = env.npm_config_sonar_scanner_version;
  }

  if (!/^[\d.]+$/.test(platformBinariesVersion)) {
    log(
      `Version "${platformBinariesVersion}" does not have a correct format. Will use default version "${DEFAULT_SCANNER_VERSION}"`,
    );
    platformBinariesVersion = DEFAULT_SCANNER_VERSION;
  }

  const targetOS = (config.targetOS = findTargetOS());

  let basePath = os.homedir();
  if (params.hasOwnProperty('basePath')) {
    basePath = params.basePath;
  } else if (env.hasOwnProperty('SONAR_BINARY_CACHE')) {
    basePath = env.SONAR_BINARY_CACHE;
  } else if (env.hasOwnProperty('npm_config_sonar_binary_cache')) {
    basePath = env.npm_config_sonar_binary_cache;
  }

  const installFolder = (config.installFolder = buildInstallFolderPath(basePath));
  config.platformExecutable = buildExecutablePath(installFolder, platformBinariesVersion);

  let baseUrl = SONAR_SCANNER_MIRROR;
  if (params.hasOwnProperty('baseUrl')) {
    baseUrl = params.baseUrl;
  } else if (env.hasOwnProperty('SONAR_SCANNER_MIRROR')) {
    baseUrl = env.SONAR_SCANNER_MIRROR;
  } else if (env.hasOwnProperty('npm_config_sonar_scanner_mirror')) {
    baseUrl = env.npm_config_sonar_scanner_mirror;
  }

  const fileName = (config.fileName =
    'sonar-scanner-cli-' + platformBinariesVersion + '-' + targetOS + '.zip');

  let finalUrl;

  try {
    finalUrl = new URL(fileName, baseUrl);
  } catch (e) {
    log(`Invalid URL "${baseUrl}". Will use default mirror "${SONAR_SCANNER_MIRROR}"`);
    finalUrl = new URL(fileName, SONAR_SCANNER_MIRROR);
  }

  config.downloadUrl = finalUrl.href;

  let proxy = '';
  if (env.hasOwnProperty('http_proxy') && typeof env.http_proxy === 'string') {
    proxy = env.http_proxy;
  }
  // Use https_proxy when available
  if (
    env.hasOwnProperty('https_proxy') &&
    typeof env.https_proxy === 'string' &&
    finalUrl.protocol === 'https:'
  ) {
    proxy = env.https_proxy;
  }
  if (proxy && proxy !== '') {
    try {
      new URL(proxy);
      const proxyAgent = new HttpsProxyAgent(proxy);
      config.httpOptions.httpRequestOptions = { agent: proxyAgent };
      config.httpOptions.httpsRequestOptions = { agent: proxyAgent };
    } catch (e) {
      log(`Invalid proxy "${proxy}"`);
    }
  }

  if (finalUrl.username !== '' || finalUrl.password !== '') {
    config.httpOptions.headers = {
      Authorization:
        'Basic ' + Buffer.from(finalUrl.username + ':' + finalUrl.password).toString('base64'),
    };
  }

  if (params.caPath) {
    config.httpOptions.ca = extractCa(params.caPath);
  }

  log(`Executable parameters built:`);
  log(config);
  return config;

  function extractCa(caPath) {
    if (!fs.existsSync(caPath)) {
      throw new Error(`Provided CA certificate path does not exist: ${caPath}`);
    }
    const ca = fs.readFileSync(caPath, 'utf8');
    if (!ca.startsWith('-----BEGIN CERTIFICATE-----')) {
      throw new Error('Invalid CA certificate');
    }
    return ca;
  }
}

/**
 * Options for child_proces.exec()
 *
 * @param {*} env the environment variables
 * @returns
 */
function extendWithExecParams(env = {}) {
  const ONE_MB = 1024 * 1024;

  return {
    env: Object.assign({}, process.env, env),
    stdio: 'inherit',
    // Increase the amount of data allowed on stdout or stderr
    // (if this value is exceeded then the child process is killed).
    // TODO: make this customizable
    maxBuffer: ONE_MB,
    shell: isWindows(), //we need to enable shell on windows due to CVE-2024-27980
  };
}
