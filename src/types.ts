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

export type SupportedOS = NodeJS.Platform | 'alpine';

export type PlatformInfo = {
  os: SupportedOS | null;
  arch: string;
};

export type JreMetaData = {
  filename: string;
  md5: string;
  javaPath: string;
};

export type ScannerLogEntry = {
  level: LogLevel;
  formattedMessage: string;
  throwable?: string;
};

export enum ScannerProperty {
  SonarVerbose = 'sonar.verbose',
  SonarToken = 'sonar.token',
  SonarExclusions = 'sonar.exclusions',
  SonarHostUrl = 'sonar.host.url',
  SonarUserHome = 'sonar.userHome',
  SonarOrganization = 'sonar.organization',
  SonarProjectBaseDir = 'sonar.projectBaseDir',
  SonarScannerSonarCloudURL = 'sonar.scanner.sonarcloudUrl',
  SonarScannerJavaExePath = 'sonar.scanner.javaExePath',
  SonarScannerWasEngineCacheHit = 'sonar.scanner.wasEngineCacheHit',
}

export type ScannerProperties = {
  [key: string]: string;
};

export type ScanOptions = {
  serverUrl?: string;
  token?: string;
  jvmOptions?: string[];
  options?: { [key: string]: string };
  caPath?: string;
  logLevel?: string;
  verbose?: boolean;
};
