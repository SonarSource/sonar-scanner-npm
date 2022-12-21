const exec = require('child_process').execFileSync;
const log = require('fancy-log');
const { getScannerParams, extendWithExecParams } = require('./config');
const {
  getSonarScannerExecutable,
  getLocalSonarScannerExecutable,
} = require('./sonar-scanner-executable');

module.exports = scan;
module.exports.promise = scanPromise;
module.exports.cli = scanCLI;
module.exports.customScanner = scanUsingCustomScanner;
module.exports.fromParam = fromParam;

const version = require('../package.json').version;

/*
 * Function used programmatically to trigger an analysis.
 */
function scan(params, callback) {
  scanCLI([], params, callback);
}

function scanPromise(params) {
  return new Promise((resolve, reject) => {
    log('Starting analysis...');

    // determine the command to run and execute it
    const sqScannerCommand = getSonarScannerExecutable();

    console.log('found sonar exec', sqScannerCommand)

    // prepare the exec options, most notably with the SQ params
    const scannerParams = getScannerParams(params, process.cwd());
    const execOptions = extendWithExecParams(scannerParams);
    try {
      exec(sqScannerCommand, fromParam(), execOptions);
      log('Analysis finished.');
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

/*
 * Function used by the '/bin/sonar-scanner' executable that accepts command line arguments.
 */
function scanCLI(cliArgs, params, callback) {
  log('Starting analysis...');

  const sqScannerCommand = getSonarScannerExecutable();

  const scannerParams = getScannerParams(params, process.cwd());
  const execOptions = extendWithExecParams(scannerParams);

  try {
    exec(sqScannerCommand, fromParam().concat(cliArgs), execOptions);
    log('Analysis finished.');
    callback();
  } catch (error) {
    process.exit(error.status);
  }
}

/*
 * Alternatively, trigger an analysis with a local install of the SonarScanner.
 */
function scanUsingCustomScanner(params, callback) {
  log('Starting analysis (with local install of the SonarScanner)...');

  // determine the command to run and execute it
  const sqScannerCommand = getLocalSonarScannerExecutable();

  // prepare the exec options, most notably with the SQ params
  const scannerParams = getScannerParams(params, process.cwd());
  const execOptions = extendWithExecParams(scannerParams);

  try {
    exec(sqScannerCommand, fromParam(), execOptions);
    log('Analysis finished.');
    callback();
  } catch (error) {
    process.exit(error.status);
  }
}

function fromParam() {
  return [`--from=ScannerNpm/${version}`];
}
