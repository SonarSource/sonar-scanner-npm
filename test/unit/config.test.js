const { assert } = require('chai');
const path = require('path');
const { getScannerParams, extendWithExecParams, DEFAULT_EXCLUSIONS } = require('../../src/config');

function pathForProject(projectFolder) {
  return path.join(__dirname, 'resources', projectFolder);
}

describe('config', function () {
  const exclusions = DEFAULT_EXCLUSIONS;

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
        SONARQUBE_SCANNER_PARAMS: JSON.stringify({
          'sonar.projectDescription': 'No description.',
          'sonar.sources': '.',
          'sonar.exclusions': exclusions,
        }),
      };

      process.env = {};

      assert.deepEqual(
        getScannerParams({}, pathForProject('fake_project_with_no_package_file')),
        expectedResult,
      );
    });

    it('should not set default values if sonar-project.properties file exists', function () {
      const expectedResult = {
      };

      process.env = {};

      assert.deepEqual(
        getScannerParams({}, pathForProject('fake_project_with_sonar_properties_file')),
        expectedResult,
      );
    });

    it('should propagate custom server and token into "SONARQUBE_SCANNER_PARAMS"', function () {
      const expectedResult = {
        'sonar.host.url': 'https://sonarcloud.io',
        'sonar.login': 'my_token',
        'sonar.projectDescription': 'No description.',
        'sonar.sources': '.',
        'sonar.exclusions': exclusions,
      };

      process.env = {};

      const sqParams = getScannerParams(
        { serverUrl: 'https://sonarcloud.io', token: 'my_token' },
        pathForProject('fake_project_with_no_package_file'),
      ).SONARQUBE_SCANNER_PARAMS;

      assert.deepEqual(JSON.parse(sqParams), expectedResult);
    });

    it('should allow to override default settings and add new ones', function () {
      const expectedResult = {
        'sonar.projectName': 'Foo',
        'sonar.projectDescription': 'No description.',
        'sonar.sources': '.',
        'sonar.tests': 'specs',
        'sonar.exclusions': exclusions,
      };

      process.env = {};

      const sqParams = getScannerParams(
        { options: { 'sonar.projectName': 'Foo', 'sonar.tests': 'specs' } },
        pathForProject('fake_project_with_no_package_file'),
      ).SONARQUBE_SCANNER_PARAMS;

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
      process.env = {};

      const sqParams = getScannerParams(
        {},
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
      process.env = {};

      const sqParams = getScannerParams(
        {},
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
        'sonar.exclusions': exclusions,
      };

      process.env = {};

      const sqParams = getScannerParams(
        {},
        pathForProject('fake_project_with_complete_package_file'),
      ).SONARQUBE_SCANNER_PARAMS;

      assert.deepEqual(JSON.parse(sqParams), expectedResult);
    });

    it('should take into account SONARQUBE_SCANNER_PARAMS env variable', function () {
      const expectedResult = {
        'sonar.host.url': 'https://sonarcloud.io',
        'sonar.login': 'my_token',
        'sonar.projectDescription': 'No description.',
        'sonar.sources': '.',
        'sonar.exclusions': exclusions,
      };

      process.env = {
        SONARQUBE_SCANNER_PARAMS: {
          'sonar.host.url': 'https://sonarcloud.io',
          'sonar.login': 'my_token',
        },
      };

      const sqParams = getScannerParams(
        {},
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
        'sonar.exclusions': exclusions,
      };

      process.env = {
        SONARQUBE_SCANNER_PARAMS: {
          'sonar.host.url': 'https://another.server.com',
          'sonar.login': 'another_token',
        },
      };

      const sqParams = getScannerParams(
        { serverUrl: 'https://sonarcloud.io', token: 'my_token' },
        pathForProject('fake_project_with_no_package_file'),
      ).SONARQUBE_SCANNER_PARAMS;

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
      process.env = {};
      const sqParams = getScannerParams(
        {},
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
      process.env = {};
      const sqParams = getScannerParams(
        {},
        pathForProject('fake_project_with_jest_report_file'),
      ).SONARQUBE_SCANNER_PARAMS;
      assert.deepEqual(JSON.parse(sqParams), expectedResult);
    });

    it('should read SONARQUBE_SCANNER_PARAMS provided by environment if it exists', function () {
      const expectedResult = {
        SONARQUBE_SCANNER_PARAMS: JSON.stringify({
          'sonar.projectDescription': 'No description.',
          'sonar.sources': '.',
          'sonar.exclusions': exclusions,
          'sonar.host.url': 'https://sonarcloud.io',
          'sonar.branch': 'dev',
        }),
      };

      process.env = {
        SONARQUBE_SCANNER_PARAMS: {
          'sonar.host.url': 'https://sonarcloud.io',
          'sonar.branch': 'dev',
        },
      };

      assert.ownInclude(
        getScannerParams({}, pathForProject('fake_project_with_no_package_file')),
        expectedResult,
      );
    });
  });

  describe('extendWithExecParams()', function () {
    it('should put the provided config in the "env" property of the exec params', function () {
      assert.deepEqual(extendWithExecParams({ hello: 2 }), {
        maxBuffer: 1024 * 1024,
        stdio: [0, 1, 2],
        env: {
          hello: 2,
        },
      });
    });
  });
});
