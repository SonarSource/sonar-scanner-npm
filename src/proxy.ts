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
import { URL } from 'url';
import { LogLevel, log } from './logging';
import { ScannerProperties, ScannerProperty } from './types';

export function getProxyUrl(properties: ScannerProperties): URL | undefined {
  const proxyHost = properties[ScannerProperty.SonarScannerProxyHost];
  const serverUsesHttps = properties[ScannerProperty.SonarHostUrl].startsWith('https');

  if (proxyHost) {
    // We assume that the proxy protocol is the same as the endpoint.
    const protocol = serverUsesHttps ? 'https' : 'http';
    const proxyPort =
      properties[ScannerProperty.SonarScannerProxyPort] ?? (serverUsesHttps ? 443 : 80);
    const proxyUser = properties[ScannerProperty.SonarScannerProxyUser] ?? '';
    const proxyPassword = properties[ScannerProperty.SonarScannerProxyPassword] ?? '';
    const proxyUrl = new URL(
      `${protocol}://${proxyUser}:${proxyPassword}@${proxyHost}:${proxyPort}`,
    );
    log(LogLevel.DEBUG, `Detecting proxy: ${proxyUrl}`);
    return proxyUrl;
  } else if (
    properties[ScannerProperty.SonarScannerProxyPort] ||
    properties[ScannerProperty.SonarScannerProxyUser] ||
    properties[ScannerProperty.SonarScannerProxyPassword]
  ) {
    log(LogLevel.WARN, `Detecting proxy: Incomplete proxy configuration. Proxy host is missing.`);
  }

  log(LogLevel.DEBUG, `Detecting proxy: No proxy detected'}`);
  return undefined;
}

export function proxyUrlToJavaOptions(properties: ScannerProperties): string[] {
  const proxyUrl = getProxyUrl(properties);
  if (!proxyUrl) {
    return [];
  }

  const protocol = properties[ScannerProperty.SonarHostUrl].startsWith('https') ? 'https' : 'http';
  return [
    `-D${protocol}.proxyHost=${proxyUrl.hostname}`,
    `-D${protocol}.proxyPort=${proxyUrl.port}`,
    `-D${protocol}.proxyUser=${proxyUrl.username}`,
    `-D${protocol}.proxyPassword=${proxyUrl.password}`,
  ];
}
