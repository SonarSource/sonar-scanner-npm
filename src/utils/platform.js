/*
 * Get the target OS based on the platform name
 */
module.exports.findTargetOS = function () {
  if (isWindows()) {
    return 'windows';
  }
  if (isLinux()) {
    return 'linux';
  }
  if (isMac()) {
    return 'macosx';
  }
  throw Error(`Your platform '${process.platform}' is currently not supported.`);
};

module.exports.isWindows = function isWindows() {
  return /^win/.test(process.platform);
};

module.exports.isMac = function isMac() {
  return /^darwin/.test(process.platform);
};

module.exports.isLinux = function isLinux() {
  return /^linux/.test(process.platform);
};
