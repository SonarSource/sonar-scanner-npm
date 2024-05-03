/*
 * sonar-scanner-npm
 * Copyright (C) 2022-2024 SonarSource SA
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
import fs from 'fs';
import path from 'path';
import { getProxyForUrl } from 'proxy-from-env';
import slugify from 'slugify';
import { version } from '../package.json';
import {
  DEFAULT_SONAR_EXCLUSIONS,
  ENV_TO_PROPERTY_NAME,
  ENV_VAR_PREFIX,
  NPM_CONFIG_ENV_VAR_PREFIX,
  SCANNER_BOOTSTRAPPER_NAME,
  SONARCLOUD_API_BASE_URL,
  SONARCLOUD_URL,
  SONARCLOUD_URL_REGEX,
  SONAR_DIR_DEFAULT,
  SONAR_PROJECT_FILENAME,
} from './constants';
import { log, LogLevel } from './logging';
import { getArch, getSupportedOS } from './platform';
import { CliArgs, ScannerProperties, ScannerProperty, ScanOptions } from './types';

function getDefaultProperties(): ScannerProperties {
  return {
    [ScannerProperty.SonarUserHome]: path.join(
      process.env.HOME ?? process.env.USERPROFILE ?? '',
      SONAR_DIR_DEFAULT,
    ),
    [ScannerProperty.SonarScannerOs]: getSupportedOS(),
    [ScannerProperty.SonarScannerArch]: getArch(),
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
): ScannerProperties {
  const packageJsonParams: { [key: string]: string } = {};
  const packageFile = path.join(projectBaseDir, 'package.json');
  let packageData;
  try {
    packageData = fs.readFileSync(packageFile).toString();
  } catch (error) {
    log(LogLevel.INFO, `Unable to read "package.json" file`);
    return {
      [ScannerProperty.SonarExclusions]: sonarBaseExclusions,
    };
  }
  const pkg = JSON.parse(packageData);
  log(LogLevel.INFO, 'Retrieving info from "package.json" file');

  function fileExistsInProjectSync(file: string) {
    return fs.existsSync(path.join(projectBaseDir, file));
  }

  function dependenceExists(pkgName: string) {
    return ['devDependencies', 'dependencies', 'peerDependencies'].some(function (prop) {
      return pkg[prop] && pkgName in pkg[prop];
    });
  }

  if (pkg) {
    const invalidCharacterRegex = /[?$*+~.()'"!:@/]/g;
    packageJsonParams['sonar.projectKey'] = slugify(pkg.name, {
      remove: invalidCharacterRegex,
    });
    packageJsonParams['sonar.projectName'] = pkg.name;
    packageJsonParams['sonar.projectVersion'] = pkg.version;
    if (pkg.description) {
      packageJsonParams['sonar.projectDescription'] = pkg.description;
    }
    if (pkg.homepage) {
      packageJsonParams['sonar.links.homepage'] = pkg.homepage;
    }
    if (pkg.bugs?.url) {
      packageJsonParams['sonar.links.issue'] = pkg.bugs.url;
    }
    if (pkg.repository?.url) {
      packageJsonParams['sonar.links.scm'] = pkg.repository.url;
    }

    const potentialCoverageDirs = [
      // jest coverage output directory
      // See: http://facebook.github.io/jest/docs/en/configuration.html#coveragedirectory-string
      pkg['nyc']?.['report-dir'],
      // nyc coverage output directory
      // See: https://github.com/istanbuljs/nyc#configuring-nyc
      pkg['jest']?.['coverageDirectory'],
    ]
      .filter(Boolean)
      .concat(
        // default coverage output directory
        'coverage',
      );
    const uniqueCoverageDirs = Array.from(new Set(potentialCoverageDirs));
    packageJsonParams[ScannerProperty.SonarExclusions] = sonarBaseExclusions;
    for (const lcovReportDir of uniqueCoverageDirs) {
      const lcovReportPath = path.posix.join(lcovReportDir, 'lcov.info');
      if (fileExistsInProjectSync(lcovReportPath)) {
        packageJsonParams[ScannerProperty.SonarExclusions] +=
          (packageJsonParams[ScannerProperty.SonarExclusions].length > 0 ? ',' : '') +
          path.posix.join(lcovReportDir, '**');
        // https://docs.sonarsource.com/sonarqube/latest/analyzing-source-code/test-coverage/javascript-typescript-test-coverage/
        packageJsonParams['sonar.javascript.lcov.reportPaths'] = lcovReportPath;
        // TODO: use Generic Test Data to remove dependence of SonarJS, it is need transformation lcov to sonar generic coverage format
      }
    }

    if (dependenceExists('mocha-sonarqube-reporter') && fileExistsInProjectSync('xunit.xml')) {
      // https://docs.sonarqube.org/display/SONAR/Generic+Test+Data
      packageJsonParams['sonar.testExecutionReportPaths'] = 'xunit.xml';
    }
    // TODO: (SCANNPM-13) use `glob` to lookup xunit format files and transformation to sonar generic report format
  }
  return packageJsonParams;
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
    const [key, value] = arg.split('=');
    properties[key] = value;
  }

  return properties;
}

/**
 * Parse properties stored in sonar project properties file, if it exists.
 */
function getSonarFileProperties(projectBaseDir: string): ScannerProperties {
  // Read sonar project properties file in project base dir
  try {
    const sonarPropertiesFile = path.join(projectBaseDir, SONAR_PROJECT_FILENAME);
    const properties: ScannerProperties = {};
    const data = fs.readFileSync(sonarPropertiesFile).toString();
    const lines = data.split(/\r?\n/);
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.length === 0 || trimmedLine.startsWith('#')) {
        continue;
      }
      const [key, value] = trimmedLine.split('=');
      properties[key] = value;
    }

    return properties;
  } catch (error) {
    log(LogLevel.WARN, `Failed to read ${SONAR_PROJECT_FILENAME} file: ${error}`);
    throw error;
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
function getEnvironmentProperties() {
  const { env } = process;

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
    // Bootstrap cache hit/miss is set later after the bootstrapper has run and before scanner engine is started
    'sonar.scanner.wasJreCacheHit': 'false',
    'sonar.scanner.wasEngineCacheHit': 'false',
  };
}

/**
 * Get endpoint properties from scanner properties.
 */
export function getHostProperties(properties: ScannerProperties): ScannerProperties {
  const sonarHostUrl = properties[ScannerProperty.SonarHostUrl]?.replace(/\/$/, '');
  const sonarApiBaseUrl = properties[ScannerProperty.SonarScannerApiBaseUrl];
  const sonarCloudSpecified =
    properties[ScannerProperty.SonarScannerSonarCloudUrl] === sonarHostUrl ||
    SONARCLOUD_URL_REGEX.exec(sonarHostUrl ?? '');

  if (!sonarHostUrl || sonarCloudSpecified) {
    return {
      [ScannerProperty.SonarScannerInternalIsSonarCloud]: 'true',
      [ScannerProperty.SonarHostUrl]:
        properties[ScannerProperty.SonarScannerSonarCloudUrl] ?? SONARCLOUD_URL,
      [ScannerProperty.SonarScannerApiBaseUrl]: sonarApiBaseUrl ?? SONARCLOUD_API_BASE_URL,
    };
  } else {
    return {
      [ScannerProperty.SonarScannerInternalIsSonarCloud]: 'false',
      [ScannerProperty.SonarHostUrl]: sonarHostUrl,
      [ScannerProperty.SonarScannerApiBaseUrl]: sonarApiBaseUrl ?? `${sonarHostUrl}/api/v2`,
    };
  }
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

export function getProperties(
  scanOptions: ScanOptions,
  startTimestampMs: number,
  cliArgs?: CliArgs,
): ScannerProperties {
  const envProperties = getEnvironmentProperties();
  const scanOptionsProperties = getScanOptionsProperties(scanOptions);
  const cliProperties = getCommandLineProperties(cliArgs);

  const userProperties: ScannerProperties = {
    ...envProperties,
    ...scanOptionsProperties,
    ...cliProperties,
  };

  // Compute default base dir respecting order of precedence we use for the final merge
  const projectBaseDir = userProperties[ScannerProperty.SonarProjectBaseDir] ?? process.cwd();

  // Infer specific properties from project files
  let inferredProperties: ScannerProperties;
  try {
    inferredProperties = getSonarFileProperties(projectBaseDir);
  } catch (error) {
    inferredProperties = {
      'sonar.projectDescription': 'No description.',
      'sonar.sources': '.',
    };

    const baseSonarExclusions =
      userProperties[ScannerProperty.SonarExclusions] ?? DEFAULT_SONAR_EXCLUSIONS;

    inferredProperties = {
      ...inferredProperties,
      ...getPackageJsonProperties(projectBaseDir, baseSonarExclusions),
    };
  }

  // Generate proxy properties from HTTP[S]_PROXY env variables, if not already set
  const httpProxyProperties = getHttpProxyEnvProperties(
    userProperties[ScannerProperty.SonarHostUrl],
  );

  // Merge properties respecting order of precedence
  const properties = {
    ...getDefaultProperties(), // fallback to default if nothing was provided for these properties
    ...inferredProperties,
    ...httpProxyProperties,
    ...userProperties, // Highest precedence
  };

  // Hotfix host properties with custom SonarCloud URL
  const hostProperties = getHostProperties(properties);

  return {
    ...properties,
    // Can't be overridden:
    ...hostProperties,
    ...getBootstrapperProperties(startTimestampMs),
    'sonar.projectBaseDir': projectBaseDir,
  };
}
