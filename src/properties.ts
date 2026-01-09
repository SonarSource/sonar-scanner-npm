/*
 * sonar-scanner-npm
 * Copyright (C) 2022-2025 SonarSource Sàrl
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
import path from 'node:path';
import { getProperties as getPropertiesFile } from 'properties-file';
import { getProxyForUrl } from 'proxy-from-env';
import slugify from 'slugify';
import {
  DEFAULT_SONAR_EXCLUSIONS,
  ENV_TO_PROPERTY_NAME,
  ENV_VAR_PREFIX,
  NPM_CONFIG_ENV_VAR_PREFIX,
  REGIONS,
  REGION_US,
  SCANNER_BOOTSTRAPPER_NAME,
  SCANNER_DEPRECATED_PROPERTIES,
  SONARCLOUD_API_BASE_URL,
  SONARCLOUD_URL,
  SONARCLOUD_URL_REGEX,
  SONARCLOUD_US_URL_REGEX,
  SONAR_DIR_DEFAULT,
  SONAR_PROJECT_FILENAME,
  SONARCLOUD_URL_US,
  SONARCLOUD_API_BASE_URL_US,
} from './constants';
import { defaultFsDeps, defaultProcessDeps, FsDeps, ProcessDeps } from './deps';
import { LogLevel, log } from './logging';
import { getArch, getSupportedOS } from './platform';
import { version } from './version';
import {
  CacheStatus,
  CliArgs,
  PackageJson,
  ScanOptions,
  ScannerProperties,
  ScannerProperty,
} from './types';

export interface PropertiesDeps {
  fsDeps?: FsDeps;
  processDeps?: ProcessDeps;
}

function getDefaultProperties(processDeps: ProcessDeps = defaultProcessDeps): ScannerProperties {
  return {
    [ScannerProperty.SonarUserHome]: path.join(
      processDeps.env.HOME ?? processDeps.env.USERPROFILE ?? '',
      SONAR_DIR_DEFAULT,
    ),
    [ScannerProperty.SonarWorkingDirectory]: '.scannerwork',
    [ScannerProperty.SonarScannerOs]: getSupportedOS(processDeps),
    [ScannerProperty.SonarScannerArch]: getArch(processDeps),
  };
}

/**
 * Convert the name of a sonar property from its environment variable form
 * (eg SONAR_SCANNER_FOO_BAR) to its sonar form (eg sonar.scanner.fooBar).
 */
function envNameToSonarPropertyNameMapper(envName: string) {
  // Extract the name and convert to camel case
  const sonarScannerKey = envName
    .substring(ENV_VAR_PREFIX.length)
    .toLowerCase()
    .replace(/_([a-z])/g, g => g[1].toUpperCase());
  return `sonar.scanner.${sonarScannerKey}`;
}

/**
 * Convert the name of a sonar property from its environment variable form
 * (eg npm_config_sonar_scanner_) to its sonar form (eg sonar.scanner.fooBar).
 */
function npmConfigEnvNameToSonarPropertyNameMapper(envName: string) {
  // Extract the name and convert to camel case
  const sonarScannerKey = envName
    .substring(NPM_CONFIG_ENV_VAR_PREFIX.length)
    .toLowerCase()
    .replace(/_([a-z])/g, g => g[1].toUpperCase());
  return `sonar.scanner.${sonarScannerKey}`;
}

/**
 * Build the config.
 */
function getPackageJsonProperties(
  projectBaseDir: string,
  sonarBaseExclusions: string,
  fsDeps: FsDeps = defaultFsDeps,
): ScannerProperties {
  const pkg = readPackageJson(projectBaseDir, fsDeps);
  if (!pkg) {
    return {
      [ScannerProperty.SonarExclusions]: sonarBaseExclusions,
    };
  }

  log(LogLevel.INFO, 'Retrieving info from "package.json" file');
  const packageJsonParams: { [key: string]: string } = {
    [ScannerProperty.SonarExclusions]: sonarBaseExclusions,
  };
  populatePackageParams(packageJsonParams, pkg);
  populateCoverageParams(packageJsonParams, pkg, projectBaseDir, sonarBaseExclusions, fsDeps);
  populateTestExecutionParams(packageJsonParams, pkg, projectBaseDir, fsDeps);

  return packageJsonParams;
}

function readPackageJson(
  projectBaseDir: string,
  fsDeps: FsDeps = defaultFsDeps,
): PackageJson | null {
  const packageFile = path.join(projectBaseDir, 'package.json');
  try {
    const packageData = fsDeps.readFileSync(packageFile).toString();
    return JSON.parse(packageData);
  } catch (error) {
    log(LogLevel.INFO, `Unable to read "package.json" file`);
    return null;
  }
}

function fileExistsInProjectSync(
  projectBaseDir: string,
  file: string,
  fsDeps: FsDeps = defaultFsDeps,
): boolean {
  return fsDeps.existsSync(path.join(projectBaseDir, file));
}

function dependenceExists(pkg: PackageJson, pkgName: string): boolean {
  return ['devDependencies', 'dependencies', 'peerDependencies'].some(function (prop) {
    const dependencyGroup = pkg[prop];
    return (
      typeof dependencyGroup === 'object' && dependencyGroup !== null && pkgName in dependencyGroup
    );
  });
}

function populatePackageParams(params: { [key: string]: string | {} }, pkg: PackageJson) {
  const invalidCharacterRegex = /[?$*+~.()'"!:@/]/g;
  if (pkg.name) {
    params['sonar.projectKey'] = slugify(pkg.name, {
      remove: invalidCharacterRegex,
    });
    params['sonar.projectName'] = pkg.name;
  }
  if (pkg.version) {
    params['sonar.projectVersion'] = pkg.version;
  }
  if (pkg.description) {
    params['sonar.projectDescription'] = pkg.description;
  }
  if (pkg.homepage) {
    params['sonar.links.homepage'] = pkg.homepage;
  }
  if (pkg.bugs?.url) {
    params['sonar.links.issue'] = pkg.bugs.url;
  }
  if (pkg.repository?.url) {
    params['sonar.links.scm'] = pkg.repository.url;
  }
}

function populateCoverageParams(
  params: { [key: string]: string },
  pkg: PackageJson,
  projectBaseDir: string,
  sonarBaseExclusions: string,
  fsDeps: FsDeps = defaultFsDeps,
) {
  const potentialCoverageDirs = [
    // nyc coverage output directory
    // See: https://github.com/istanbuljs/nyc#configuring-nyc
    pkg['nyc']?.['report-dir'],
    // jest coverage output directory
    // See: http://facebook.github.io/jest/docs/en/configuration.html#coveragedirectory-string
    pkg['jest']?.['coverageDirectory'],
  ]
    .filter(Boolean)
    .concat(
      // default coverage output directory
      'coverage',
    );

  const uniqueCoverageDirs = Array.from(new Set(potentialCoverageDirs));
  params[ScannerProperty.SonarExclusions] = sonarBaseExclusions;
  for (const lcovReportDir of uniqueCoverageDirs) {
    const lcovReportPath = lcovReportDir && path.posix.join(lcovReportDir, 'lcov.info');
    if (lcovReportPath && fileExistsInProjectSync(projectBaseDir, lcovReportPath, fsDeps)) {
      params[ScannerProperty.SonarExclusions] +=
        (params[ScannerProperty.SonarExclusions].length > 0 ? ',' : '') +
        path.posix.join(lcovReportDir, '**');
      // TODO: (SCANNPM-34) use Generic Test Data to remove dependence of SonarJS, it is need transformation lcov to sonar generic coverage format
      params['sonar.javascript.lcov.reportPaths'] = lcovReportPath;
      // https://docs.sonarsource.com/sonarqube/latest/analyzing-source-code/test-coverage/javascript-typescript-test-coverage/
    }
  }
}

function populateTestExecutionParams(
  params: { [key: string]: string },
  pkg: PackageJson,
  projectBaseDir: string,
  fsDeps: FsDeps = defaultFsDeps,
) {
  if (
    dependenceExists(pkg, 'mocha-sonarqube-reporter') &&
    fileExistsInProjectSync(projectBaseDir, 'xunit.xml', fsDeps)
  ) {
    // https://docs.sonarqube.org/display/SONAR/Generic+Test+Data
    params['sonar.testExecutionReportPaths'] = 'xunit.xml';
    // TODO: (SCANNPM-13) use `glob` to lookup xunit format files and transformation to sonar generic report format
  }
}

/**
 * Convert CLI args into scanner properties.
 */
function getCommandLineProperties(cliArgs?: CliArgs): ScannerProperties {
  const properties: ScannerProperties = {};

  if (cliArgs?.debug) {
    properties[ScannerProperty.SonarVerbose] = 'true';
  }

  const { define } = cliArgs ?? {};
  if (!define || define.length === 0) {
    return properties;
  }

  // Parse CLI args (eg: -Dsonar.token=xxx)
  for (const arg of define) {
    const [key, ...value] = arg.split('=');
    properties[key] = value.join('=');
  }

  return properties;
}

/**
 * Parse properties stored in sonar project properties file, if it exists.
 * Return an empty object if the file does not exist.
 */
function getSonarFileProperties(
  projectBaseDir: string,
  fsDeps: FsDeps = defaultFsDeps,
): ScannerProperties {
  // Read sonar project properties file in project base dir
  try {
    const sonarPropertiesFile = path.join(projectBaseDir, SONAR_PROJECT_FILENAME);
    const data = fsDeps.readFileSync(sonarPropertiesFile);
    return getPropertiesFile(data) as ScannerProperties;
  } catch (error) {
    log(LogLevel.DEBUG, `Failed to read ${SONAR_PROJECT_FILENAME} file: ${error}`);
    return {};
  }
}

/**
 * Get scanner properties from scan option object (JS API).
 */
function getScanOptionsProperties(scanOptions: ScanOptions): ScannerProperties {
  const properties = {
    ...scanOptions.options,
  };

  if (typeof scanOptions.serverUrl !== 'undefined') {
    properties[ScannerProperty.SonarHostUrl] = scanOptions.serverUrl;
  }

  if (typeof scanOptions.token !== 'undefined') {
    properties[ScannerProperty.SonarToken] = scanOptions.token;
  }

  if (typeof scanOptions.verbose !== 'undefined') {
    properties[ScannerProperty.SonarVerbose] = scanOptions.verbose ? 'true' : 'false';
  }

  if (typeof scanOptions.version !== 'undefined') {
    properties[ScannerProperty.SonarScannerCliVersion] = scanOptions.version;
  }

  return properties;
}

/**
 * Automatically parse properties from environment variables.
 */
function getEnvironmentProperties(processDeps: ProcessDeps = defaultProcessDeps) {
  const { env } = processDeps;

  const jsonEnvVariables = ['SONAR_SCANNER_JSON_PARAMS', 'SONARQUBE_SCANNER_PARAMS'];

  let properties: ScannerProperties = {};

  // Get known environment variables
  for (const [envName, scannerProperty] of ENV_TO_PROPERTY_NAME) {
    if (envName in env) {
      const envValue = env[envName];

      if (typeof envValue !== 'undefined') {
        properties[scannerProperty] = envValue;
      }
    }
  }

  // Get generic environment variables
  properties = {
    ...properties,
    ...Object.fromEntries(
      Object.entries(env)
        .filter(([key]) => key.startsWith(NPM_CONFIG_ENV_VAR_PREFIX))
        .filter(([key]) => !jsonEnvVariables.includes(key))
        .map(([key, value]) => [npmConfigEnvNameToSonarPropertyNameMapper(key), value as string]),
    ),
    ...Object.fromEntries(
      Object.entries(env)
        .filter(([key]) => key.startsWith(ENV_VAR_PREFIX))
        .filter(([key]) => !jsonEnvVariables.includes(key))
        .map(([key, value]) => [envNameToSonarPropertyNameMapper(key), value as string]),
    ),
  };

  // Get JSON parameters from env
  try {
    const jsonParams = env.SONAR_SCANNER_JSON_PARAMS ?? env.SONARQUBE_SCANNER_PARAMS;
    if (jsonParams) {
      properties = {
        ...JSON.parse(jsonParams),
        ...properties,
      };
    }
    if (!env.SONAR_SCANNER_JSON_PARAMS && env.SONARQUBE_SCANNER_PARAMS) {
      log(
        LogLevel.WARN,
        'SONARQUBE_SCANNER_PARAMS is deprecated, please use SONAR_SCANNER_JSON_PARAMS instead',
      );
    }
  } catch (e) {
    log(LogLevel.WARN, `Failed to parse JSON parameters from ENV: ${e}`);
  }

  return properties;
}

/**
 * Get bootstrapper properties, that can not be overridden.
 */
function getBootstrapperProperties(startTimestampMs: number): ScannerProperties {
  return {
    'sonar.scanner.app': SCANNER_BOOTSTRAPPER_NAME,
    'sonar.scanner.appVersion': version,
    'sonar.scanner.bootstrapStartTime': startTimestampMs.toString(),
    // These cache statuses are set during the bootstrapping process.
    // We already set them here to prevent them from being overridden.
    'sonar.scanner.wasJreCacheHit': CacheStatus.Disabled,
    'sonar.scanner.wasEngineCacheHit': 'false',
  };
}

/**
 * Get endpoint properties from scanner properties.
 */
export function getHostProperties(properties: ScannerProperties): ScannerProperties {
  const sonarHostUrl = properties[ScannerProperty.SonarHostUrl]?.replace(/\/$/, '')?.trim();
  const sonarApiBaseUrl = properties[ScannerProperty.SonarScannerApiBaseUrl];
  const sonarCloudSpecified = isSonarCloud(properties, sonarHostUrl);

  if (!sonarHostUrl || sonarCloudSpecified) {
    const region = (properties[ScannerProperty.SonarRegion] ?? '').toLowerCase();
    if (isSonarCloudUS(sonarHostUrl) || region === REGION_US) {
      return {
        [ScannerProperty.SonarScannerInternalIsSonarCloud]: 'true',
        [ScannerProperty.SonarHostUrl]:
          properties[ScannerProperty.SonarScannerSonarCloudUrl] ?? SONARCLOUD_URL_US,
        [ScannerProperty.SonarScannerApiBaseUrl]: sonarApiBaseUrl ?? SONARCLOUD_API_BASE_URL_US,
      };
    } else if (isSonarCloudEU(sonarHostUrl) || region === '') {
      return {
        [ScannerProperty.SonarScannerInternalIsSonarCloud]: 'true',
        [ScannerProperty.SonarHostUrl]:
          properties[ScannerProperty.SonarScannerSonarCloudUrl] ?? SONARCLOUD_URL,
        [ScannerProperty.SonarScannerApiBaseUrl]: sonarApiBaseUrl ?? SONARCLOUD_API_BASE_URL,
      };
    } else {
      const regionsPrint = REGIONS.map(r => `"${r}"`);
      throw new Error(
        `Unsupported region '${region}'. List of supported regions: ${regionsPrint}. Please check the '${ScannerProperty.SonarRegion}' property or the 'SONAR_REGION' environment variable.`,
      );
    }
  } else {
    return {
      [ScannerProperty.SonarScannerInternalIsSonarCloud]: 'false',
      [ScannerProperty.SonarHostUrl]: sonarHostUrl,
      [ScannerProperty.SonarScannerApiBaseUrl]: sonarApiBaseUrl ?? `${sonarHostUrl}/api/v2`,
    };
  }
}

function isSonarCloud(properties: ScannerProperties, sonarHostUrl: string) {
  return (
    properties[ScannerProperty.SonarScannerSonarCloudUrl] === sonarHostUrl ||
    isSonarCloudEU(sonarHostUrl) ||
    isSonarCloudUS(sonarHostUrl)
  );
}

function isSonarCloudEU(sonarHostUrl: string) {
  return SONARCLOUD_URL_REGEX.exec(sonarHostUrl ?? '');
}

function isSonarCloudUS(sonarHostUrl: string) {
  return SONARCLOUD_US_URL_REGEX.exec(sonarHostUrl ?? '');
}

function getHttpProxyEnvProperties(serverUrl: string): ScannerProperties {
  const proxyUrl = getProxyForUrl(serverUrl);
  // If no proxy is set, return the properties as is
  if (!proxyUrl) {
    return {};
  }

  // Parse the proxy URL
  const url = new URL(proxyUrl);
  const properties: ScannerProperties = {};
  properties[ScannerProperty.SonarScannerProxyHost] = url.hostname;
  if (url.port) {
    properties[ScannerProperty.SonarScannerProxyPort] = url.port;
  }
  if (url.username) {
    properties[ScannerProperty.SonarScannerProxyUser] = url.username;
  }
  if (url.password) {
    properties[ScannerProperty.SonarScannerProxyPassword] = url.password;
  }
  return properties;
}

function hotfixDeprecatedProperties(properties: ScannerProperties): ScannerProperties {
  for (const [oldProp, newProp] of SCANNER_DEPRECATED_PROPERTIES) {
    if (typeof properties[oldProp] !== 'undefined') {
      if (typeof properties[newProp] === 'undefined') {
        log(
          LogLevel.WARN,
          `Property "${oldProp}" is deprecated and will be removed in a future version. Please use "${newProp}" instead.`,
        );
        properties[newProp] = properties[oldProp];
      } else {
        log(
          LogLevel.WARN,
          `Both properties "${oldProp}" and "${newProp}" are set. "${oldProp}" is deprecated and will be removed in a future version. Value of deprecated property "${oldProp}" will be ignored.`,
        );
        properties[oldProp] = properties[newProp];
      }
    }
  }

  return properties;
}

function normalizeProperties(properties: ScannerProperties) {
  for (const [key, value] of Object.entries(properties)) {
    if (value === null) {
      properties[key] = '';
    } else if (typeof value === 'undefined') {
      delete properties[key];
    } else {
      properties[key] = value.toString().trim();
    }
  }

  return properties;
}

export function getProperties(
  scanOptions: ScanOptions,
  startTimestampMs: number,
  cliArgs?: CliArgs,
  deps: PropertiesDeps = {},
): ScannerProperties {
  const { fsDeps = defaultFsDeps, processDeps = defaultProcessDeps } = deps;

  const envProperties = getEnvironmentProperties(processDeps);
  const scanOptionsProperties = getScanOptionsProperties(scanOptions);
  const cliProperties = getCommandLineProperties(cliArgs);

  const userProperties: ScannerProperties = {
    ...envProperties,
    ...scanOptionsProperties,
    ...cliProperties,
  };

  // Compute default base dir and exclusions respecting order of precedence we use for the final merge
  const projectBaseDir = userProperties[ScannerProperty.SonarProjectBaseDir] ?? processDeps.cwd();
  const baseSonarExclusions =
    userProperties[ScannerProperty.SonarExclusions] ?? DEFAULT_SONAR_EXCLUSIONS;

  // Infer specific properties from project files
  const inferredProperties = {
    ...getPackageJsonProperties(projectBaseDir, baseSonarExclusions, fsDeps),
    ...getSonarFileProperties(projectBaseDir, fsDeps),
  };

  // Generate proxy properties from HTTP[S]_PROXY env variables, if not already set
  const httpProxyProperties = getHttpProxyEnvProperties(
    userProperties[ScannerProperty.SonarHostUrl],
  );

  // Merge properties respecting order of precedence
  let properties = {
    ...getDefaultProperties(processDeps), // fallback to default if nothing was provided for these properties
    ...inferredProperties,
    ...httpProxyProperties,
    ...userProperties, // Highest precedence
  };

  properties = hotfixDeprecatedProperties({
    ...properties,
    // Can't be overridden:
    ...getHostProperties(properties), // Hotfix host properties with custom SonarCloud URL
    ...getBootstrapperProperties(startTimestampMs),
    'sonar.projectBaseDir': projectBaseDir,
  });

  properties = normalizeProperties(properties);

  return properties;
}
