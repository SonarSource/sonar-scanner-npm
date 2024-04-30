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
});
