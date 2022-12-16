const { assert } = require('chai');
const path = require('path');
const { getConfig } = require('../../src/config');
const sinon = require('sinon');

function pathForProject(projectFolder) {
  return path.join(__dirname, 'resources', projectFolder);
}

describe('config', function () {
  const exclusions = 'node_modules/**,bower_components/**,jspm_packages/**,typings/**,lib-cov/**';

  let envBackup = {};
  beforeEach(function () {
    envBackup = Object.assign({}, process.env);
  });
  afterEach(function () {
    process.env = Object.assign({}, envBackup);
  });

  describe('getConfig()', function () {
    it('should provide default values', function () {
      const expectedResult = {
        maxBuffer: 1024 * 1024,
        stdio: [0, 1, 2],
        env: {
          SONARQUBE_SCANNER_PARAMS: JSON.stringify({
            'sonar.projectDescription': 'No description.',
            'sonar.sources': '.',
            'sonar.exclusions': exclusions,
          }),
        },
      };

      process.env = {};

      assert.deepEqual(
        getConfig({}, pathForProject('fake_project_with_no_package_file')),
        expectedResult,
      );
    });

    it('should read SONARQUBE_SCANNER_PARAMS provided by environment if it exists', function () {
      const expectedResult = {
        maxBuffer: 1024 * 1024,
        stdio: [0, 1, 2],
        env: {
          SONARQUBE_SCANNER_PARAMS: JSON.stringify({
            'sonar.projectDescription': 'No description.',
            'sonar.sources': '.',
            'sonar.exclusions': exclusions,
            'sonar.host.url': 'https://sonarcloud.io',
            'sonar.branch': 'dev',
          }),
        },
      };

      process.env = {
        SONARQUBE_SCANNER_PARAMS: JSON.stringify({
          'sonar.host.url': 'https://sonarcloud.io',
          'sonar.branch': 'dev',
        }),
      };

      assert.deepEqual(
        getConfig({}, pathForProject('fake_project_with_no_package_file')),
        expectedResult,
      );
    });
  });
});
