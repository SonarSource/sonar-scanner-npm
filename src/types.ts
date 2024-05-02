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
import { LogLevel } from './logging';

export type CacheFileData = { checksum: string; filename: string };

export type ScannerLogEntry = {
  level: LogLevel;
  formattedMessage: string;
  throwable?: string;
};

export enum ScannerProperty {
  SonarVerbose = 'sonar.verbose',
  SonarLogLevel = 'sonar.log.level',
  SonarToken = 'sonar.token',
  SonarExclusions = 'sonar.exclusions',
  SonarHostUrl = 'sonar.host.url',
  SonarUserHome = 'sonar.userHome',
  SonarScannerApiBaseUrl = 'sonar.scanner.apiBaseUrl',
  SonarScannerOs = 'sonar.scanner.os',
  SonarScannerArch = 'sonar.scanner.arch',
  SonarOrganization = 'sonar.organization',
  SonarProjectBaseDir = 'sonar.projectBaseDir',
  SonarScannerSonarCloudUrl = 'sonar.scanner.sonarcloudUrl',
  SonarScannerJavaExePath = 'sonar.scanner.javaExePath',
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
  caPath?: string;
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
