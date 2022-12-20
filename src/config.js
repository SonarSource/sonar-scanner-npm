const sonarScannerParams = require('./sonar-scanner-params');
const { findTargetOS, buildInstallFolderPath, buildExecutablePath } = require('./utils');
const os = require('os');
const log = require('fancy-log');
const HttpsProxyAgent = require('https-proxy-agent');

module.exports.getScannerParams = getScannerParams;
module.exports.extendWithExecParams = extendWithExecParams;
module.exports.getExecutableParams = getExecutableParams;

const DEFAULT_EXCLUSIONS =
  'node_modules/**,bower_components/**,jspm_packages/**,typings/**,lib-cov/**';
module.exports.DEFAULT_EXCLUSIONS = DEFAULT_EXCLUSIONS;
const DEFAULT_SCANNER_VERSION = '4.7.0.2747';
module.exports.DEFAULT_SCANNER_VERSION = DEFAULT_SCANNER_VERSION;

/**
 * Build the SONARQUBE_SCANNER_PARAMS which will be passed as an environment
 * variable to the scanner.
 *
 * @returns
 */
function getScannerParams(params = {}, basePath) {
  const config = {};

  const sqScannerParams = sonarScannerParams(
    params,
    basePath,
    process.env.SONARQUBE_SCANNER_PARAMS,
  );

  // We need to merge the existing env variables (process.env) with the SQ ones
  if (sqScannerParams) {
    config.SONARQUBE_SCANNER_PARAMS = sqScannerParams;
  }

  return config;
}

/**
 * Gather the parameters for sonar-scanner-executable
 */
function getExecutableParams() {
  const config = {};
  const env = process.env;

  const platformBinariesVersion =
    env.SONAR_SCANNER_VERSION || env.npm_config_sonar_scanner_version || DEFAULT_SCANNER_VERSION;

  const targetOS = findTargetOS();

  const basePath = env.SONAR_BINARY_CACHE || env.npm_config_sonar_binary_cache || os.homedir();

  const installFolder = (config.installFolder = buildInstallFolderPath(basePath));
  config.platformExecutable = buildExecutablePath(installFolder, platformBinariesVersion);

  const baseUrl =
    process.env.SONAR_SCANNER_MIRROR ||
    process.env.npm_config_sonar_scanner_mirror ||
    SONAR_SCANNER_MIRROR;
  const fileName = 'sonar-scanner-cli-' + platformBinariesVersion + '-' + targetOS + '.zip';
  const downloadUrl = (config.downloadUrl = baseUrl + fileName);

  const proxy = process.env.http_proxy;
  log(`Downloading from ${downloadUrl}`);
  log(`(executable will be saved in cache folder: ${installFolder})`);
  if (proxy && proxy !== '') {
    const proxyAgent = new HttpsProxyAgent(proxy);
    const proxyUrl = new URL(proxy);
    config.httpOptions = {
      httpRequestOptions: { agent: proxyAgent },
      httpsRequestOptions: { agent: proxyAgent },
    };
    const port = proxyUrl.port === '' ? '' : `:${proxyUrl.port}`;
    log(`Using proxy server ${proxyUrl.protocol}//${proxyUrl.hostname}${port}`);
  }
  return config;
}

/**
 * Options for child_proces.exec()
 *
 * @param {*} env the environment variables
 * @returns
 */
function extendWithExecParams(env = {}) {
  return {
    env,
    stdio: [0, 1, 2],
    // Increase the amount of data allowed on stdout or stderr
    // (if this value is exceeded then the child process is killed).
    // TODO: make this customizable
    maxBuffer: 1024 * 1024,
  };
}
