const { assert } = require('chai');
const path = require('path');
const fs = require('fs');
const os = require('os');
const mkdirpSync = require('mkdirp').sync;
const rimraf = require('rimraf');
const { getSonarScannerExecutable } = require('../../src/sonar-scanner-executable');
const { DEFAULT_SCANNER_VERSION } = require('../../src/config');
const { buildInstallFolderPath, buildExecutablePath } = require('../../src/utils');

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
  });
});
