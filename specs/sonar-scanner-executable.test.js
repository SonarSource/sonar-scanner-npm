const { assert } = require('chai');
const sinon = require('sinon');
const path = require('path');
const fs = require('fs');
const mkdirpSync = require('mkdirp').sync;
const {
  prepareExecEnvironment,
  getInstallFolderPath,
  getSonarScannerExecutable,
} = require('../src/sonar-scanner-executable');
const platformUtils = require('../src/utils/platform');

describe('sqScannerExecutable', function () {
  const exclusions = 'node_modules/**,bower_components/**,jspm_packages/**,typings/**,lib-cov/**';

  describe('prepareExecEnvironment()', function () {
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

      const fakeProcess = {
        env: {},
        cwd: function () {
          return pathForProject('fake_project_with_no_package_file');
        },
      };

      assert.deepEqual(prepareExecEnvironment({}, fakeProcess), expectedResult);
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

      const fakeProcess = {
        env: {
          SONARQUBE_SCANNER_PARAMS: JSON.stringify({
            'sonar.host.url': 'https://sonarcloud.io',
            'sonar.branch': 'dev',
          }),
        },
        cwd: function () {
          return pathForProject('fake_project_with_no_package_file');
        },
      };

      assert.deepEqual(prepareExecEnvironment({}, fakeProcess), expectedResult);
    });
  });

  describe('getInstallFolderPath()', function () {
    it('should use SONAR_BINARY_CACHE env when exists', function () {
      process.env.SONAR_BINARY_CACHE = './test-cache';
      assert.equal(getInstallFolderPath(), 'test-cache/.sonar/native-sonar-scanner', 'congrats');
    });
  });

  describe('getSonarScannerExecutable()', function () {
    it('should not execute callback when download of executable failed', function () {
      process.env.SONAR_SCANNER_MIRROR = 'http://fake.url/sonar-scanner';
      let executed = false;
      const callback = function () {
        executed = true;
      };

      getSonarScannerExecutable(callback);

      assert.equal(executed, false);
    });

    describe('when running on Windows', function () {
      it('run on Windows', function () {
        const stub = sinon.stub(platformUtils, 'isWindows');
        stub.returns(true);

        getSonarScannerExecutable(() => {});
        stub.restore();
      });
    });

    describe('when the executable exists', function () {
      const FOLDER = path.join(__dirname, '../test-cache/.sonar/native-sonar-scanner/sonar-scanner-4.7.0.2747-macosx/bin/');
      const FILEPATH = path.join(FOLDER, 'sonar-scanner');
      before(function () {
        ;
        mkdirpSync(FOLDER);
        fs.writeFileSync(FILEPATH, 'delete me');
      });
      after(function () {
        fs.unlinkSync(FILEPATH)
      });
      it('should run the callback with it as parameter', function (done) {
        function callback(receivedExecutable) {
          assert.isTrue(receivedExecutable.includes('sonar-scanner'));
          done();
        }
        getSonarScannerExecutable(callback);
      });
    });
  });
});

function pathForProject(projectFolder) {
  return path.join(process.cwd(), 'specs', 'resources', projectFolder);
}
