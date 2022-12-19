const sonarScannerParams = require('./sonar-scanner-params');

module.exports.getConfig = getConfig;
module.exports.wrapWithExecParams = wrapWithExecParams;

const DEFAULT_SCANNER_VERSION = '4.7.0.2747';
const DEFAULT_EXCLUSIONS =
  'node_modules/**,bower_components/**,jspm_packages/**,typings/**,lib-cov/**';
module.exports.DEFAULT_SCANNER_VERSION = DEFAULT_SCANNER_VERSION;
module.exports.DEFAULT_EXCLUSIONS = DEFAULT_EXCLUSIONS;

function getConfig(params = {}, basePath) {
  const env = process.env;
  let config = env;

  const sqScannerParams = sonarScannerParams(params, basePath, env.SONARQUBE_SCANNER_PARAMS);

  // We need to merge the existing env variables (process.env) with the SQ ones
  if (!isEmpty(sqScannerParams)) {
    config.SONARQUBE_SCANNER_PARAMS = JSON.stringify(sqScannerParams);
  }

  config.platformBinariesVersion =
    process.env.SONAR_SCANNER_VERSION ||
    process.env.npm_config_sonar_scanner_version ||
    DEFAULT_SCANNER_VERSION;

  return config;
}

/**
 * Options for child_proces.exec()
 *
 * @param {*} env the environment variables
 * @returns
 */
function wrapWithExecParams(env = {}) {
  return {
    env,
    stdio: [0, 1, 2],
    // Increase the amount of data allowed on stdout or stderr
    // (if this value is exceeded then the child process is killed).
    // TODO: make this customizable
    maxBuffer: 1024 * 1024,
  };
}

function isEmpty(jsObject) {
  return jsObject.constructor === Object && Object.entries(jsObject).length === 0;
}
