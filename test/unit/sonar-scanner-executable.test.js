/*
 * sonar-scanner-npm
 * Copyright (C) 2022-2024 SonarSource SA
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
const { getScannerExecutable } = require('../../src/sonar-scanner-executable');
const { DEFAULT_SCANNER_VERSION, getExecutableParams } = require('../../src/config');
const { buildInstallFolderPath, buildExecutablePath } = require('../../src/utils');
const { startServer, closeServerPromise } = require('./fixtures/webserver/server');

describe('sqScannerExecutable', function () {
  describe('Sonar: getScannerExecutable(false)', function () {
    it('should throw exception when the download of executable fails', async function () {
      process.env.SONAR_SCANNER_MIRROR = 'http://fake.url/sonar-scanner';
      try {
        await getScannerExecutable(false, {
          basePath: os.tmpdir(),
        });
        assert.fail();
      } catch (err) {
        console.log(err);
        assert.equal(err.message, 'getaddrinfo ENOTFOUND fake.url');
      }
    }, 60000);

    describe('when the executable exists', function () {
      let filepath;
      beforeAll(function () {
        filepath = buildExecutablePath(
          buildInstallFolderPath(os.tmpdir()),
          DEFAULT_SCANNER_VERSION,
        );
        mkdirpSync(path.dirname(filepath));
        fs.writeFileSync(filepath, 'echo "hello"');
        fs.chmodSync(filepath, 0o700);
      });
      afterAll(function () {
        rimraf.sync(filepath);
      });
      it('should return the path to it', async function () {
        const receivedExecutable = await getScannerExecutable(false, {
          basePath: os.tmpdir(),
        });
        assert.equal(receivedExecutable, filepath);
      });
    });

    describe('when the executable is downloaded', function () {
      let server, config, pathToZip, pathToUnzippedExecutable, expectedPlatformExecutablePath;
      const FILENAME = 'test-executable.zip';
      beforeAll(async function () {
        server = await startServer();
        config = getExecutableParams({ fileName: FILENAME });
        expectedPlatformExecutablePath = config.platformExecutable;
      });
      afterAll(async function () {
        await closeServerPromise(server);
        pathToZip = path.join(config.installFolder, config.fileName);
        pathToUnzippedExecutable = path.join(config.installFolder, 'executable');
        rimraf.sync(pathToZip);
        rimraf.sync(pathToUnzippedExecutable);
      });
      it('should download the executable, unzip it and return a path to it.', async function () {
        const execPath = await getScannerExecutable(false, {
          baseUrl: `http://${server.address().address}:${server.address().port}`,
          fileName: FILENAME,
        });
        assert.equal(execPath, expectedPlatformExecutablePath);
      });
    });

    describe('when providing a self-signed CA certificate', function () {
      let caPath;
      beforeAll(() => {
        caPath = path.join(os.tmpdir(), 'ca.pem');
        fs.writeFileSync(caPath, '-----BEGIN CERTIFICATE-----');
      });

      it('should fail if the provided path is invalid', async function () {
        try {
          await getScannerExecutable(false, { caPath: 'invalid-path' });
          assert.fail('should have thrown');
        } catch (e) {
          assert.equal(e.message, 'Provided CA certificate path does not exist: invalid-path');
        }
      });
      it('should proceed with the download if the provided CA certificate is valid', async function () {
        process.env.SONAR_SCANNER_MIRROR = 'http://fake.url/sonar-scanner';
        try {
          await getScannerExecutable(false, {
            caPath: caPath,
            basePath: os.tmpdir(),
          });
          assert.fail('should have thrown');
        } catch (e) {
          assert.equal(e.message, 'getaddrinfo ENOTFOUND fake.url');
        }
      });
    });
  });

  describe('when providing an invalid CA certificate', function () {
    let caPath;
    beforeAll(() => {
      caPath = path.join(os.tmpdir(), 'ca.pem');
      fs.writeFileSync(caPath, '-----ILLEGAL CERTIFICATE-----');
    });

    it('should fail if the provided path is invalid', async function () {
      try {
        await getScannerExecutable(false, { caPath });
        assert.fail('should have thrown');
      } catch (e) {
        assert.equal(e.message, 'Invalid CA certificate');
      }
    });
  });

  describe('local: getScannerExecutable(true)', () => {
    it('should fail when the executable is not found', async () => {
      assert.throws(
        getScannerExecutable.bind(null, true),
        'Local install of SonarScanner not found in: sonar-scanner',
      );
      //expect(getScannerExecutable(true)).to.eventually.be.rejectedWith('Local install of SonarScanner not found in: sonar-scanner');
    });
  });
});
