const sonarScannerParams = require('./sonar-scanner-params');

module.exports.getScannerParams = getScannerParams;
module.exports.extendWithExecParams = extendWithExecParams;

const DEFAULT_EXCLUSIONS =
  'node_modules/**,bower_components/**,jspm_packages/**,typings/**,lib-cov/**';
module.exports.DEFAULT_EXCLUSIONS = DEFAULT_EXCLUSIONS;

function getScannerParams(params = {}, basePath) {
  let config = {};

  const env = process.env;
  const sqScannerParams = sonarScannerParams(params, basePath, env.SONARQUBE_SCANNER_PARAMS);

  // We need to merge the existing env variables (process.env) with the SQ ones
  if (sqScannerParams) {
    config.SONARQUBE_SCANNER_PARAMS = sqScannerParams;
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
