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
import slugify from 'slugify';
import { version } from '../package.json';
import {
  DEFAULT_SONAR_EXCLUSIONS,
  ENV_TO_PROPERTY_NAME,
  ENV_VAR_PREFIX,
  SCANNER_BOOTSTRAPPER_NAME,
  SCANNER_CLI_VERSION,
  SONARCLOUD_URL,
  SONARCLOUD_URL_REGEX,
  SONAR_DIR_DEFAULT,
  SONAR_PROJECT_FILENAME,
} from './constants';
import { LogLevel, log } from './logging';
import { getArch, getSupportedOS } from './platform';
import { ScanOptions, ScannerProperties, ScannerProperty } from './types';

function getDefaultProperties(): ScannerProperties {
  return {
    [ScannerProperty.SonarUserHome]: path.join(
      process.env.HOME ?? process.env.USERPROFILE ?? '',
      SONAR_DIR_DEFAULT,
    ),
    [ScannerProperty.SonarScannerCliVersion]: SCANNER_CLI_VERSION, // TODO: move back to scanner-cli since its a specific use case
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
      'sonar.exclusions': sonarBaseExclusions,
    };
  }
  const pkg = JSON.parse(packageData);
  log(LogLevel.INFO, 'Retrieving info from "package.json" file');

  function fileExistsInProjectSync(file: string) {
    return fs.existsSync(path.resolve(projectBaseDir, file));
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
    packageJsonParams['sonar.exclusions'] = sonarBaseExclusions;
    for (const lcovReportDir of uniqueCoverageDirs) {
      const lcovReportPath = path.posix.join(lcovReportDir, 'lcov.info');
      if (fileExistsInProjectSync(lcovReportPath)) {
        packageJsonParams['sonar.exclusions'] +=
          (packageJsonParams['sonar.exclusions'].length > 0 ? ',' : '') +
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
function getCommandLineProperties(cliArgs?: string[]): ScannerProperties {
  if (!cliArgs || cliArgs.length === 0) {
    return {};
  }

  // Parse CLI args (eg: -Dsonar.token=xxx)
  const properties: ScannerProperties = {};
  for (const arg of cliArgs) {
    if (!arg.startsWith('-D')) {
      continue;
    }
    const [key, value] = arg.substring(2).split('=');
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
  } catch (error: any) {
    log(LogLevel.WARN, `Failed to read ${SONAR_PROJECT_FILENAME} file: ${error.message}`);
    throw error;
  }
}

/**
 * Get scanner properties from scan option object (JS API).
 */
function getScanOptionsProperties(scanOptions: ScanOptions): ScannerProperties {
  const options = {
    ...scanOptions.options,
  };

  if (typeof scanOptions.serverUrl !== 'undefined') {
    options[ScannerProperty.SonarHostUrl] = scanOptions.serverUrl;
  }

  if (typeof scanOptions.token !== 'undefined') {
    options[ScannerProperty.SonarToken] = scanOptions.token;
  }

  if (typeof scanOptions.verbose !== 'undefined') {
    options[ScannerProperty.SonarVerbose] = scanOptions.verbose ? 'true' : 'false';
  }

  return options;
}

/**
 * Automatically parse properties from environment variables.
 */
export function getEnvironmentProperties() {
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
  let sonarHostUrl = properties[ScannerProperty.SonarHostUrl] ?? '';

  if (!sonarHostUrl || SONARCLOUD_URL_REGEX.exec(sonarHostUrl)) {
    return {
      [ScannerProperty.SonarScannerInternalIsSonarCloud]: 'true',
      [ScannerProperty.SonarHostUrl]:
        properties[ScannerProperty.SonarScannerSonarCloudURL] ?? SONARCLOUD_URL,
    };
  }
  return {
    [ScannerProperty.SonarScannerInternalIsSonarCloud]: 'false',
    [ScannerProperty.SonarHostUrl]: sonarHostUrl,
  };
}

export function getProperties(
  scanOptions: ScanOptions,
  startTimestampMs: number,
  cliArgs?: string[],
): ScannerProperties {
  const bootstrapperProperties = getBootstrapperProperties(startTimestampMs);
  const cliProperties = getCommandLineProperties(cliArgs);
  const scanOptionsProperties = getScanOptionsProperties(scanOptions);
  const envProperties = getEnvironmentProperties();

  // Compute default base dir respecting order of precedence we use for the final merge
  const projectBaseDir =
    cliProperties[ScannerProperty.SonarProjectBaseDir] ??
    scanOptionsProperties[ScannerProperty.SonarProjectBaseDir] ??
    envProperties[ScannerProperty.SonarProjectBaseDir] ??
    process.cwd();

  let inferredProperties: ScannerProperties;
  try {
    inferredProperties = getSonarFileProperties(projectBaseDir);
  } catch (error) {
    inferredProperties = {
      'sonar.projectDescription': 'No description.',
      'sonar.sources': '.',
    };

    const baseSonarExclusions =
      cliProperties[ScannerProperty.SonarExclusions] ??
      scanOptionsProperties[ScannerProperty.SonarExclusions] ??
      envProperties[ScannerProperty.SonarExclusions] ??
      DEFAULT_SONAR_EXCLUSIONS;

    inferredProperties = {
      ...inferredProperties,
      ...getPackageJsonProperties(projectBaseDir, baseSonarExclusions),
    };
  }

  // Merge properties respecting order of precedence
  const properties = {
    ...getDefaultProperties(), // fallback to default if nothing was provided for these properties
    ...envProperties, // Lowest precedence
    ...inferredProperties,
    ...scanOptionsProperties,
    ...cliProperties, // Highest precedence
    ...bootstrapperProperties, // Can't be overridden
    ...{ 'sonar.projectBaseDir': projectBaseDir }, // Manually computed, can't be overridden
  };

  return {
    ...properties,
    ...getHostProperties(properties),
  };
}
