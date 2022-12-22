/*
 * sonar-scanner-npm
 * Copyright (C) 2022-2022 SonarSource SA
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

    console.log('found sonar exec', sqScannerCommand);

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
