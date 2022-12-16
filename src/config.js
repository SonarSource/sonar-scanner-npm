const sonarScannerParams = require('./sonar-scanner-params');

module.exports.getConfig = getConfig;

function getConfig(params, basePath) {
  const env = process.env;
  let config = {};

  if (env.SONARQUBE_SCANNER_PARAMS) {
    config = JSON.parse(env.SONARQUBE_SCANNER_PARAMS);
  }

  const sqScannerParams = sonarScannerParams(params, basePath, config);

  // We need to merge the existing env variables (process.env) with the SQ ones
  const mergedEnv = Object.assign({}, env, {
    SONARQUBE_SCANNER_PARAMS: JSON.stringify(sqScannerParams),
  });

  return wrapWithExecParams(mergedEnv);
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
