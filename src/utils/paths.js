const path = require('path');

module.exports.buildExecutablePath = function (installFolder, platformBinariesVersion, targetOS, binaryExtension) {
  return path.join(
    installFolder,
    `sonar-scanner-${platformBinariesVersion}-${targetOS}`,
    'bin',
    `sonar-scanner${binaryExtension}`,
  );
}
