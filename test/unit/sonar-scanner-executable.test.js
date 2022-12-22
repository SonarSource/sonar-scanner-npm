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
const { assert } = require('chai');
const path = require('path');
const fs = require('fs');
const os = require('os');
const mkdirpSync = require('mkdirp').sync;
const rimraf = require('rimraf');
const { getSonarScannerExecutable } = require('../../src/sonar-scanner-executable');
const { DEFAULT_SCANNER_VERSION } = require('../../src/config');
const { buildInstallFolderPath, buildExecutablePath } = require('../../src/utils');
const { startServer, closeServerPromise } = require('./resources/webserver/server');

describe('sqScannerExecutable', function () {
  describe('getSonarScannerExecutable()', function () {
    it('should return null when the download of executable fails', function () {
      // better: read some log
      process.env.SONAR_SCANNER_MIRROR = 'http://fake.url/sonar-scanner';
      const executable = getSonarScannerExecutable();

      assert.equal(executable, null);
    });

    describe('when the executable exists', function () {
      let filepath;
      before(function () {
        filepath = buildExecutablePath(
          buildInstallFolderPath(os.homedir()),
          DEFAULT_SCANNER_VERSION,
        );
        mkdirpSync(path.dirname(filepath));
        fs.writeFileSync(filepath, 'echo "hello"');
        fs.chmodSync(filepath, 0o700);
      });
      after(function () {
        rimraf.sync(filepath);
      });
      it('should return the path to it', function () {
        const receivedExecutable = getSonarScannerExecutable();
        assert.equal(receivedExecutable, filepath);
      });
    });

    describe.only('when the executable is downloaded', function () {
      let server, reqCallback;
      before(async function () {
        server = await startServer(reqCallback);
        console.log('server listening on', server.address());
      });
      after(async function () {
        await closeServerPromise(server);
      });
      it('should download the executable, unzip it and return a path to it.', async function () {
        reqCallback = function (request) {
          assert.exists(request);
          console.log('got', request);
        };

        await getSonarScannerExecutable({
          baseUrl: `http://${server.address().address}:${server.address().port}`,
        });
      });
    });
  });
});
