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
const os = require('os');
const {
  getScannerParams,
  extendWithExecParams,
  DEFAULT_EXCLUSIONS,
  getExecutableParams,
  DEFAULT_SCANNER_VERSION,
  SONAR_SCANNER_MIRROR,
} = require('../../src/config');
const { buildInstallFolderPath, buildExecutablePath } = require('../../src/utils/paths');
const { findTargetOS } = require('../../src/utils/platform');

function pathForProject(projectFolder) {
  return path.join(__dirname, 'fixtures', projectFolder);
}

describe('config', function () {
  let envBackup = {};
  beforeEach(function () {
    envBackup = Object.assign({}, process.env);
  });
  afterEach(function () {
    process.env = Object.assign({}, envBackup);
  });

  describe('getExecutableParams()', function () {
    it('should set http proxy configuration if proxy configuration is provided', function () {
      process.env = {
        http_proxy: 'http://user:password@proxy:3128',
      };
      const config = getExecutableParams();
      assert.exists(config.httpOptions.httpRequestOptions.agent);
      assert.exists(config.httpOptions.httpsRequestOptions.agent);
      assert.equal(config.httpOptions.httpRequestOptions.agent.proxy.username, 'user');
      assert.equal(config.httpOptions.httpRequestOptions.agent.proxy.password, 'password');
      assert.equal(config.httpOptions.httpRequestOptions.agent.proxy.hostname, 'proxy');
      assert.equal(config.httpOptions.httpRequestOptions.agent.proxy.port, 3128);
      assert.equal(config.httpOptions.httpRequestOptions.agent.proxy.protocol, 'http:');
      assert.deepEqual(
        config.httpOptions.httpRequestOptions.agent,
        config.httpOptions.httpsRequestOptions.agent,
      );
    });

    it('should set https proxy configuration if proxy configuration is provided', function () {
      process.env = {
        https_proxy: 'https://user:password@proxy:3128',
      };
      const config = getExecutableParams();
      assert.exists(config.httpOptions.httpRequestOptions.agent);
      assert.exists(config.httpOptions.httpsRequestOptions.agent);
      assert.equal(config.httpOptions.httpRequestOptions.agent.proxy.username, 'user');
      assert.equal(config.httpOptions.httpRequestOptions.agent.proxy.password, 'password');
      assert.equal(config.httpOptions.httpRequestOptions.agent.proxy.hostname, 'proxy');
      assert.equal(config.httpOptions.httpRequestOptions.agent.proxy.port, 3128);
      assert.equal(config.httpOptions.httpRequestOptions.agent.proxy.protocol, 'https:');
      assert.deepEqual(
        config.httpOptions.httpRequestOptions.agent,
        config.httpOptions.httpsRequestOptions.agent,
      );
    });

    it('should prefer https over http proxy configuration if proxy configuration is provided on a HTTPS url', function () {
      process.env = {
        http_proxy: 'http://user:password@httpproxy:3128',
        https_proxy: 'https://user:password@httpsproxy:3128',
      };
      const config = getExecutableParams();
      assert.exists(config.httpOptions.httpRequestOptions.agent);
      assert.exists(config.httpOptions.httpsRequestOptions.agent);
      assert.equal(config.httpOptions.httpRequestOptions.agent.proxy.username, 'user');
      assert.equal(config.httpOptions.httpRequestOptions.agent.proxy.password, 'password');
      assert.equal(config.httpOptions.httpRequestOptions.agent.proxy.hostname, 'httpsproxy');
      assert.equal(config.httpOptions.httpRequestOptions.agent.proxy.port, 3128);
      assert.equal(config.httpOptions.httpRequestOptions.agent.proxy.protocol, 'https:');
      assert.deepEqual(
        config.httpOptions.httpRequestOptions.agent,
        config.httpOptions.httpsRequestOptions.agent,
      );
    });

    it('should prefer http over https proxy configuration if proxy configuration is provided on a HTTP url', function () {
      process.env = {
        http_proxy: 'http://user:password@httpproxy:3128',
        https_proxy: 'https://user:password@httpsproxy:3128',
      };
      const config = getExecutableParams({
        baseUrl: 'http://example.com/sonarqube-repository/',
      });
      assert.exists(config.httpOptions.httpRequestOptions.agent);
      assert.exists(config.httpOptions.httpsRequestOptions.agent);
      assert.equal(config.httpOptions.httpRequestOptions.agent.proxy.username, 'user');
      assert.equal(config.httpOptions.httpRequestOptions.agent.proxy.password, 'password');
      assert.equal(config.httpOptions.httpRequestOptions.agent.proxy.hostname, 'httpproxy');
      assert.equal(config.httpOptions.httpRequestOptions.agent.proxy.port, 3128);
      assert.equal(config.httpOptions.httpRequestOptions.agent.proxy.protocol, 'http:');
      assert.deepEqual(
        config.httpOptions.httpRequestOptions.agent,
        config.httpOptions.httpsRequestOptions.agent,
      );
    });

    // TODO: add a test to verify we throw an error that is useful to the user
    it('should not set the http proxy if url is invalid', function () {
      process.env = {
        http_proxy: 'http://user:password@httpp:roxy:3128',
      };
      const config = getExecutableParams();
      assert.notExists(config.httpOptions.httpRequestOptions);
    });

    // TODO: do we care to cover this in a test? the code is pretty simple
    it('should not set baseURL if url is invalid', function () {
      const config = getExecutableParams({
        baseUrl: 'http://example.com:80:80/sonarqube-repository/',
      });
      assert.equal(
        config.downloadUrl,
        new URL(
          'sonar-scanner-cli-' + DEFAULT_SCANNER_VERSION + '-' + config.targetOS + '.zip',
          SONAR_SCANNER_MIRROR,
        ),
      );
    });

    // TODO: is this part of the ecosystem and do we want it?
    it('should take the version from env or params', function () {
      process.env.npm_config_sonar_scanner_version = '4.8.1.3023';
      assert.equal(
        getExecutableParams().downloadUrl,
        new URL(
          'sonar-scanner-cli-' + '4.8.1.3023' + '-' + findTargetOS() + '.zip',
          SONAR_SCANNER_MIRROR,
        ),
      );

      process.env.SONAR_SCANNER_VERSION = '5.0.0.2966';
      assert.equal(
        getExecutableParams().downloadUrl,
        new URL(
          'sonar-scanner-cli-' + '5.0.0.2966' + '-' + findTargetOS() + '.zip',
          SONAR_SCANNER_MIRROR,
        ),
      );

      assert.equal(
        getExecutableParams({ version: '4.7.0.2747' }).downloadUrl,
        new URL(
          'sonar-scanner-cli-' + '4.7.0.2747' + '-' + findTargetOS() + '.zip',
          SONAR_SCANNER_MIRROR,
        ),
      );
    });

    // TODO: validate this is still a valid use case and still works (might be part of axios and not our responsibility)
    it('should consume and preserve username and password for sonar-scanner mirror server', function () {
      process.env = {};
      const config = getExecutableParams({
        baseUrl: 'https://user:password@example.com/sonarqube-repository/',
      });
      assert.exists(config.httpOptions.headers['Authorization']);
      assert.equal(config.httpOptions.headers['Authorization'], 'Basic dXNlcjpwYXNzd29yZA==');
    });
  });
});
