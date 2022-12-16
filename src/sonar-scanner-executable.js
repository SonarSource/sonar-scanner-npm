const os = require('os');
const exec = require('child_process').execSync;
const mkdirs = require('mkdirp').sync;
const { DownloaderHelper } = require('node-downloader-helper');
const HttpsProxyAgent = require('https-proxy-agent');
const decompress = require('decompress');
const ProgressBar = require('progress');
const log = require('fancy-log');
const logError = log.error;
const sonarScannerParams = require('./sonar-scanner-params');
const { isWindows, findTargetOS, buildExecutablePath, buildInstallFolderPath } = require('./utils');

const SONAR_SCANNER_MIRROR = 'https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/';
const SONAR_SCANNER_VERSION = '4.7.0.2747';

module.exports.getSonarScannerExecutable = getSonarScannerExecutable;
module.exports.getLocalSonarScannerExecutable = getLocalSonarScannerExecutable;
module.exports.SONAR_SCANNER_VERSION = SONAR_SCANNER_VERSION;

const bar = new ProgressBar('[:bar] :percent :etas', {
  complete: '=',
  incomplete: ' ',
  width: 20,
  total: 0,
});

/*
 * Returns the SQ Scanner executable for the current platform
 */
function getSonarScannerExecutable() {
  const platformBinariesVersion =
    process.env.SONAR_SCANNER_VERSION ||
    process.env.npm_config_sonar_scanner_version ||
    SONAR_SCANNER_VERSION;
  const targetOS = findTargetOS();
  const basePath =
    process.env.SONAR_BINARY_CACHE || process.env.npm_config_sonar_binary_cache || os.homedir();
  const installFolder = buildInstallFolderPath(basePath);
  const platformExecutable = buildExecutablePath(installFolder, platformBinariesVersion);

  // #1 - Try to execute the scanner
  try {
    return getLocalSonarScannerExecutable(platformExecutable);
  } catch (e) {}

  // #2 - Download the binaries and unzip them
  //      They are located at https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-${version}-${os}.zip
  log('Proceed with download of the platform binaries for SonarScanner...');
  log('Creating ' + installFolder);
  mkdirs(installFolder);
  const baseUrl =
    process.env.SONAR_SCANNER_MIRROR ||
    process.env.npm_config_sonar_scanner_mirror ||
    SONAR_SCANNER_MIRROR;
  const fileName = 'sonar-scanner-cli-' + platformBinariesVersion + '-' + targetOS + '.zip';
  const downloadUrl = baseUrl + fileName;
  const proxy = process.env.http_proxy || '';
  let proxyAgent;
  let httpOptions = {};
  log(`Downloading from ${downloadUrl}`);
  log(`(executable will be saved in cache folder: ${installFolder})`);
  if (proxy && proxy !== '') {
    proxyAgent = new HttpsProxyAgent(proxy);
    const proxyUrl = new URL(proxy);
    httpOptions = {
      httpRequestOptions: { agent: proxyAgent },
      httpsRequestOptions: { agent: proxyAgent },
    };
    const port = proxyUrl.port === '' ? '' : `:${proxyUrl.port}`;
    log(`Using proxy server ${proxyUrl.protocol}//${proxyUrl.hostname}${port}`);
  }
  const downloader = new DownloaderHelper(downloadUrl, installFolder, httpOptions);
  // node-downloader-helper recommends defining both an onError and a catch because:
  //   "if on('error') is not defined, an error will be thrown when the error event is emitted and
  //    not listing, this is because EventEmitter is designed to throw an unhandled error event
  //    error if not been listened and is too late to change it now."
  downloader.on('error', _ => {});
  downloader.on('download', downloadInfo => {
    bar.total = downloadInfo.totalSize;
  });
  downloader.on('progress', stats => {
    bar.update(stats.progress / 100);
  });
  downloader
    .start()
    .then(() => {
      decompress(`${installFolder}/${fileName}`, installFolder).then(() => {
        return platformExecutable;
      });
    })
    .catch(err => {
      logError(`ERROR: impossible to download and extract binary: ${err.message}`);
      logError(`       SonarScanner binaries probably don't exist for your OS (${targetOS}).`);
      logError(
        '       In such situation, the best solution is to install the standard SonarScanner (requires a JVM).',
      );
      logError(
        '       Check it out at https://redirect.sonarsource.com/doc/install-configure-scanner.html',
      );
    });
}

/**
 * Verifies if the provided (or default) command is executable
 * Throws otherwise
 *
 * @param {*} command the command to execute.
 * @returns the command to execute
 */
function getLocalSonarScannerExecutable(command = 'sonar-scanner') {
  if (isWindows()) {
    command += '.bat';
  }

  try {
    log(`Trying to find a local install of the SonarScanner: ${command}`);
    exec(command + ' -v', {});
    // TODO: we should check that it's at least v2.8+
    log('Local install of Sonarscanner found.');
    return command;
  } catch (e) {
    throw Error(`Local install of SonarScanner not found in: ${command}`);
  }
}
