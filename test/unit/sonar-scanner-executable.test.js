const { assert } = require('chai');
const path = require('path');
const fs = require('fs');
const os = require('os');
const mkdirpSync = require('mkdirp').sync;
const rimraf = require('rimraf');
const {
  prepareExecEnvironment,
  getSonarScannerExecutable,
  SONAR_SCANNER_VERSION,
} = require('../../src/sonar-scanner-executable');
const platformUtils = require('../../src/utils/platform');
const { buildInstallFolderPath, buildExecutablePath } = require('../../src/utils');

describe('sqScannerExecutable', function () {
  describe('getSonarScannerExecutable()', function () {
    it('should return null when download of executable failed', function () {
      // better: read some log
      process.env.SONAR_SCANNER_MIRROR = 'http://fake.url/sonar-scanner';
      const executable = getSonarScannerExecutable();

      assert.equal(executable, null);
    });

    describe('when the executable exists', function () {
      let filepath;
      before(function () {
        filepath = buildExecutablePath(buildInstallFolderPath(os.homedir()), SONAR_SCANNER_VERSION);
        mkdirpSync(path.dirname(filepath));
        fs.writeFileSync(filepath, 'echo "hello"');
        fs.chmodSync(filepath, 0o700);
      });
      after(function () {
        rimraf.sync(filepath);
      });
      it('should run the callback with it as parameter', function () {
        const receivedExecutable = getSonarScannerExecutable();
        assert.isTrue(receivedExecutable.includes('sonar-scanner'));
      });
    });
  });
});
