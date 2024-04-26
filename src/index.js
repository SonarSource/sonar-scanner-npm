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

const exec = require('child_process').execFileSync;
const log = require('fancy-log');
const { getScannerParams, extendWithExecParams } = require('./config');
const { getScannerExecutable } = require('./sonar-scanner-executable');
const version = require('../package.json').version;

/*
 * Function used programmatically to trigger an analysis.
 */
async function scan(params, cliArgs = [], localScanner = false) {
  log('Starting analysis...');

  // determine the command to run and execute it
  const sqScannerCommand = await getScannerExecutable(localScanner, params);

  // prepare the exec options, most notably with the SQ params
  const scannerParams = getScannerParams(process.cwd(), params);
  const execOptions = extendWithExecParams(scannerParams);
  exec(sqScannerCommand, fromParam().concat(cliArgs), execOptions);
  log('Analysis finished.');
}

function scanWithCallback(params, cliArgs, localScanner, callback) {
  // here we make the code unit-testable - i.e. by making the scan property stub-able
  // this is not nice - and anyway when we move to ESM it won't work anymore because the module will be read-only -
  // but for now, it allows us to unit test the module
  module.exports.scan(params, cliArgs, localScanner).then(() => {
    callback();
  });
}

function fromParam() {
  return [`--from=ScannerNpm/${version}`];
}

module.exports = (params, callback) => scanWithCallback(params, [], false, callback);
module.exports.scan = scan;
module.exports.cli = (cliArgs, params, callback) =>
  scanWithCallback(params, cliArgs, false, callback);
module.exports.customScanner = (params, callback) => scanWithCallback(params, [], true, callback);
module.exports.async = async params => {
  await scan(params);
};
module.exports.fromParam = fromParam;
