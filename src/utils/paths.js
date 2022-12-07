const path = require('path');
const { isWindows } = require('./platform');

module.exports.buildExecutablePath = function (installFolder, platformBinariesVersion, targetOS, binaryExtension) {
  return path.join(
    installFolder,
    `sonar-scanner-${platformBinariesVersion}-${targetOS}`,
    'bin',
    `sonar-scanner${binaryExtension}`,
  );
}

module.exports.getInstallFolderPath = function (basePath) {
  return path.join(basePath, '.sonar', 'native-sonar-scanner');
}

module.exports.getBinaryExtension = function () {
  if (isWindows()) {
    return '.bat';
  } else {
    return '';
  }
}
