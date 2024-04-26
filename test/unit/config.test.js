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
const { findTargetOS, isWindows } = require('../../src/utils/platform');

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

  describe('getScannerParams()', function () {
    it('should provide default values', function () {
      const expectedResult = {
        'sonar.projectDescription': 'No description.',
        'sonar.sources': '.',
        'sonar.exclusions': DEFAULT_EXCLUSIONS,
      };

      assert.deepEqual(
        JSON.parse(
          getScannerParams(pathForProject('fake_project_with_no_package_file'))
            .SONARQUBE_SCANNER_PARAMS,
        ),
        expectedResult,
      );
    });

    it('should not set default values if sonar-project.properties file exists', function () {
      const expectedResult = {};

      assert.deepEqual(
        getScannerParams(pathForProject('fake_project_with_sonar_properties_file')),
        expectedResult,
      );
    });

    it('should propagate custom server and token into "SONARQUBE_SCANNER_PARAMS"', function () {
      const expectedResult = {
        'sonar.host.url': 'https://sonarcloud.io',
        'sonar.token': 'my_token',
        'sonar.projectDescription': 'No description.',
        'sonar.sources': '.',
        'sonar.exclusions': DEFAULT_EXCLUSIONS,
      };

      const sqParams = getScannerParams(pathForProject('fake_project_with_no_package_file'), {
        serverUrl: 'https://sonarcloud.io',
        token: 'my_token',
      }).SONARQUBE_SCANNER_PARAMS;

      assert.deepEqual(JSON.parse(sqParams), expectedResult);
    });

    it('should allow to override default settings and add new ones', function () {
      const expectedResult = {
        'sonar.projectName': 'Foo',
        'sonar.projectDescription': 'No description.',
        'sonar.sources': '.',
        'sonar.tests': 'specs',
        'sonar.exclusions': DEFAULT_EXCLUSIONS,
      };

      const sqParams = getScannerParams(pathForProject('fake_project_with_no_package_file'), {
        options: { 'sonar.projectName': 'Foo', 'sonar.tests': 'specs' },
      }).SONARQUBE_SCANNER_PARAMS;

      assert.deepEqual(JSON.parse(sqParams), expectedResult);
    });

    it('should get mandatory information from basic package.json file', function () {
      const expectedResult = {
        'sonar.javascript.lcov.reportPaths': 'coverage/lcov.info',
        'sonar.projectKey': 'fake-basic-project',
        'sonar.projectName': 'fake-basic-project',
        'sonar.projectDescription': 'No description.',
        'sonar.projectVersion': '1.0.0',
        'sonar.sources': '.',
        'sonar.exclusions':
          'node_modules/**,bower_components/**,jspm_packages/**,typings/**,lib-cov/**,coverage/**',
      };

      const sqParams = getScannerParams(
        pathForProject('fake_project_with_basic_package_file'),
      ).SONARQUBE_SCANNER_PARAMS;

      assert.deepEqual(JSON.parse(sqParams), expectedResult);
    });

    it('should get mandatory information from scoped packages package.json file', function () {
      const expectedResult = {
        'sonar.projectKey': 'myfake-basic-project',
        'sonar.projectName': '@my/fake-basic-project',
        'sonar.projectDescription': 'No description.',
        'sonar.projectVersion': '1.0.0',
        'sonar.sources': '.',
        'sonar.exclusions':
          'node_modules/**,bower_components/**,jspm_packages/**,typings/**,lib-cov/**',
      };

      const sqParams = getScannerParams(
        pathForProject('fake_project_with_scoped_package_name'),
      ).SONARQUBE_SCANNER_PARAMS;

      assert.deepEqual(JSON.parse(sqParams), expectedResult);
    });

    it('should get all information from package.json file', function () {
      const expectedResult = {
        'sonar.projectKey': 'fake-project',
        'sonar.projectName': 'fake-project',
        'sonar.projectDescription': 'A fake project',
        'sonar.projectVersion': '1.0.0',
        'sonar.links.homepage': 'https://github.com/fake/project',
        'sonar.links.issue': 'https://github.com/fake/project/issues',
        'sonar.links.scm': 'git+https://github.com/fake/project.git',
        'sonar.sources': '.',
        'sonar.testExecutionReportPaths': 'xunit.xml',
        'sonar.exclusions': DEFAULT_EXCLUSIONS,
      };

      const sqParams = getScannerParams(
        pathForProject('fake_project_with_complete_package_file'),
      ).SONARQUBE_SCANNER_PARAMS;

      assert.deepEqual(JSON.parse(sqParams), expectedResult);
    });

    it('should take into account SONARQUBE_SCANNER_PARAMS env variable', function () {
      const expectedResult = {
        'sonar.host.url': 'https://sonarcloud.io',
        'sonar.token': 'my_token',
        'sonar.projectDescription': 'No description.',
        'sonar.sources': '.',
        'sonar.exclusions': DEFAULT_EXCLUSIONS,
      };

      process.env = {
        SONARQUBE_SCANNER_PARAMS: JSON.stringify({
          'sonar.host.url': 'https://sonarcloud.io',
          'sonar.token': 'my_token',
        }),
      };

      const sqParams = getScannerParams(
        pathForProject('fake_project_with_no_package_file'),
      ).SONARQUBE_SCANNER_PARAMS;

      assert.deepEqual(JSON.parse(sqParams), expectedResult);
    });

    it('should make priority to user options over SONARQUBE_SCANNER_PARAMS env variable', function () {
      const expectedResult = {
        'sonar.host.url': 'https://sonarcloud.io',
        'sonar.login': 'my_token',
        'sonar.projectDescription': 'No description.',
        'sonar.sources': '.',
        'sonar.exclusions': DEFAULT_EXCLUSIONS,
      };

      process.env = {
        SONARQUBE_SCANNER_PARAMS: JSON.stringify({
          'sonar.host.url': 'https://another.server.com',
          'sonar.login': 'another_token',
        }),
      };

      const sqParams = getScannerParams(pathForProject('fake_project_with_no_package_file'), {
        serverUrl: 'https://sonarcloud.io',
        login: 'my_token',
      }).SONARQUBE_SCANNER_PARAMS;

      assert.deepEqual(JSON.parse(sqParams), expectedResult);
    });

    it('should get nyc lcov file path from package.json file', function () {
      const expectedResult = {
        'sonar.javascript.lcov.reportPaths': 'nyc-coverage/lcov.info',
        'sonar.projectKey': 'fake-basic-project',
        'sonar.projectName': 'fake-basic-project',
        'sonar.projectDescription': 'No description.',
        'sonar.projectVersion': '1.0.0',
        'sonar.sources': '.',
        'sonar.exclusions':
          'node_modules/**,bower_components/**,jspm_packages/**,typings/**,lib-cov/**,nyc-coverage/**',
      };

      const sqParams = getScannerParams(
        pathForProject('fake_project_with_nyc_report_file'),
      ).SONARQUBE_SCANNER_PARAMS;
      assert.deepEqual(JSON.parse(sqParams), expectedResult);
    });

    it('should get jest lcov file path from package.json file', function () {
      const expectedResult = {
        'sonar.javascript.lcov.reportPaths': 'jest-coverage/lcov.info',
        'sonar.projectKey': 'fake-basic-project',
        'sonar.projectName': 'fake-basic-project',
        'sonar.projectDescription': 'No description.',
        'sonar.projectVersion': '1.0.0',
        'sonar.sources': '.',
        'sonar.exclusions':
          'node_modules/**,bower_components/**,jspm_packages/**,typings/**,lib-cov/**,jest-coverage/**',
      };

      const sqParams = getScannerParams(
        pathForProject('fake_project_with_jest_report_file'),
      ).SONARQUBE_SCANNER_PARAMS;
      assert.deepEqual(JSON.parse(sqParams), expectedResult);
    });

    it('should read SONARQUBE_SCANNER_PARAMS provided by environment if it exists', function () {
      const expectedResult = {
        SONARQUBE_SCANNER_PARAMS: JSON.stringify({
          'sonar.projectDescription': 'No description.',
          'sonar.sources': '.',
          'sonar.exclusions': DEFAULT_EXCLUSIONS,
          'sonar.host.url': 'https://sonarcloud.io',
          'sonar.branch.name': 'dev',
        }),
      };

      process.env = {
        SONARQUBE_SCANNER_PARAMS: JSON.stringify({
          'sonar.host.url': 'https://sonarcloud.io',
          'sonar.branch.name': 'dev',
        }),
      };

      assert.ownInclude(
        getScannerParams(pathForProject('fake_project_with_no_package_file')),
        expectedResult,
      );
    });
  });

  describe('extendWithExecParams()', function () {
    it('should put the provided config in the "env" property of the exec params', function () {
      process.env = {
        whatsup: 'dog',
      };

      assert.deepEqual(extendWithExecParams({ hello: 2 }), {
        maxBuffer: 1024 * 1024,
        stdio: 'inherit',
        shell: isWindows(),
        env: {
          hello: 2,
          whatsup: 'dog',
        },
      });
    });

    it('should set default empty object if no params are provided', function () {
      process.env = {};

      assert.deepEqual(extendWithExecParams(), {
        env: {},
        maxBuffer: 1024 * 1024,
        shell: isWindows(),
        stdio: 'inherit',
      });
    });
  });

  describe('getExecutableParams()', function () {
    it('should set default values if no params are provided', function () {
      process.env = {};
      const targetOS = findTargetOS();
      const fileName = 'sonar-scanner-cli-' + DEFAULT_SCANNER_VERSION + '-' + targetOS + '.zip';
      const installFolder = buildInstallFolderPath(os.homedir());
      assert.deepEqual(getExecutableParams(), {
        installFolder,
        fileName,
        platformExecutable: buildExecutablePath(installFolder, DEFAULT_SCANNER_VERSION),
        targetOS,
        downloadUrl: new URL(fileName, SONAR_SCANNER_MIRROR).href,
        httpOptions: {},
      });
    });

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

    it('should not set the http proxy if url is invalid', function () {
      process.env = {
        http_proxy: 'http://user:password@httpp:roxy:3128',
      };
      const config = getExecutableParams();
      assert.notExists(config.httpOptions.httpRequestOptions);
    });

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

    it('should not set the scanner version if invalid', function () {
      process.env.npm_config_sonar_scanner_version = '4 && rm -rf';
      assert.equal(
        getExecutableParams().downloadUrl,
        new URL(
          'sonar-scanner-cli-' + DEFAULT_SCANNER_VERSION + '-' + findTargetOS() + '.zip',
          SONAR_SCANNER_MIRROR,
        ),
      );
    });

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
