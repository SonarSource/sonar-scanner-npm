/*
 * sonar-scanner-npm
 * Copyright (C) SonarSource Sàrl
 * mailto:info AT sonarsource DOT com
 *
 * You can redistribute and/or modify this program under the terms of
 * the Sonar Source-Available License Version 1, as published by SonarSource Sàrl.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the Sonar Source-Available License for more details.
 *
 * You should have received a copy of the Sonar Source-Available License
 * along with this program; if not, see https://sonarsource.com/license/ssal/
 */
import { LogLevel } from './logging';

export type CacheFileData = { checksum: string; filename: string; alias: string };

export type ScannerLogEntry = {
  level: LogLevel;
  message: string;
  stacktrace?: string;
};

export enum ScannerProperty {
  SonarVerbose = 'sonar.verbose',
  SonarLogLevel = 'sonar.log.level',
  SonarToken = 'sonar.token',
  SonarExclusions = 'sonar.exclusions',
  SonarHostUrl = 'sonar.host.url',
  SonarUserHome = 'sonar.userHome',
  SonarWorkingDirectory = 'sonar.working.directory',
  SonarScannerApiBaseUrl = 'sonar.scanner.apiBaseUrl',
  SonarScannerOs = 'sonar.scanner.os',
  SonarScannerArch = 'sonar.scanner.arch',
  SonarOrganization = 'sonar.organization',
  SonarProjectBaseDir = 'sonar.projectBaseDir',
  SonarRegion = 'sonar.region',
  SonarScannerSonarCloudUrl = 'sonar.scanner.sonarcloudUrl',
  SonarScannerJavaExePath = 'sonar.scanner.javaExePath',
  SonarScannerJavaOptions = 'sonar.scanner.javaOpts',
  SonarScannerWasJreCacheHit = 'sonar.scanner.wasJreCacheHit',
  SonarScannerWasEngineCacheHit = 'sonar.scanner.wasEngineCacheHit',
  SonarScannerProxyHost = 'sonar.scanner.proxyHost',
  SonarScannerProxyPort = 'sonar.scanner.proxyPort',
  SonarScannerProxyUser = 'sonar.scanner.proxyUser',
  SonarScannerProxyPassword = 'sonar.scanner.proxyPassword',
  SonarScannerResponseTimeout = 'sonar.scanner.responseTimeout',
  SonarScannerSkipJreProvisioning = 'sonar.scanner.skipJreProvisioning',
  SonarScannerInternalDumpToFile = 'sonar.scanner.internal.dumpToFile',
  SonarScannerTruststorePath = 'sonar.scanner.truststorePath',
  SonarScannerKeystorePath = 'sonar.scanner.keystorePath',
  SonarScannerKeystorePassword = 'sonar.scanner.keystorePassword',
  SonarScannerTruststorePassword = 'sonar.scanner.truststorePassword',
  SonarScannerInternalIsSonarCloud = 'sonar.scanner.internal.isSonarCloud',
  SonarScannerInternalSqVersion = 'sonar.scanner.internal.sqVersion',
  SonarScannerCliVersion = 'sonar.scanner.version',
  SonarScannerCliMirror = 'sonar.scanner.mirror',
  // Deprecated properties:
  SonarWsTimeout = 'sonar.ws.timeout',
  HttpProxyHost = 'http.proxyHost',
  HttpProxyPort = 'http.proxyPort',
  HttpProxyUser = 'http.proxyUser',
  HttpProxyPassword = 'http.proxyPassword',
  SonarLogin = 'sonar.login',
}

export type ScannerProperties = {
  [key: string]: string;
};

export type ScanOptions = {
  serverUrl?: string;
  token?: string;
  jvmOptions?: string[];
  localScannerCli?: boolean;
  options?: { [key: string]: string };
  logLevel?: string;
  verbose?: boolean;
  version?: string;
};

export type CliArgs = {
  debug?: boolean;
  define?: string[];
};

export type AnalysisJreMetaData = {
  id: string;
  filename: string;
  sha256: string;
  javaPath: string;
  os: string;
  arch: string;
  downloadUrl?: string;
};

export type AnalysisJresResponseType = AnalysisJreMetaData[];

export type AnalysisEngineResponseType = {
  filename: string;
  sha256: string;
  downloadUrl?: string;
};

export enum CacheStatus {
  Hit = 'hit',
  Miss = 'miss',
  Disabled = 'disabled',
}

export type PackageJson = {
  name: string;
  version: string;
  scripts?: { [key: string]: string };
  dependencies?: { [key: string]: string };
  devDependencies?: { [key: string]: string };
  [key: string]: unknown;
  bugs: {
    url: string;
    email: string;
  };
  repository: {
    type: string;
    url: string;
  };
  jest?: {
    coverageDirectory?: string;
  };
  nyc?: { 'report-dir'?: string };
};
