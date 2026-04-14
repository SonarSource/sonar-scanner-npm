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
import { URL } from 'node:url';
import { LogLevel, log } from './logging';
import { type ScannerProperties, ScannerProperty } from './types';

export function getProxyUrl(properties: ScannerProperties): URL | undefined {
  const proxyHost = properties[ScannerProperty.SonarScannerProxyHost];

  if (proxyHost) {
    const proxyPort = properties[ScannerProperty.SonarScannerProxyPort] ?? '80';
    const proxyUser = properties[ScannerProperty.SonarScannerProxyUser] ?? '';
    const proxyPassword = properties[ScannerProperty.SonarScannerProxyPassword] ?? '';
    // SCANNPM-47 We assume the proxy is HTTP. HTTPS proxies are not supported by the scanner yet (CONNECT over TLS)
    const proxyUrl = new URL(`http://${proxyUser}:${proxyPassword}@${proxyHost}:${proxyPort}`);
    log(LogLevel.DEBUG, `Detecting proxy: ${proxyUrl}`);
    return proxyUrl;
  } else if (
    properties[ScannerProperty.SonarScannerProxyPort] ||
    properties[ScannerProperty.SonarScannerProxyUser] ||
    properties[ScannerProperty.SonarScannerProxyPassword]
  ) {
    log(LogLevel.WARN, `Detecting proxy: Incomplete proxy configuration. Proxy host is missing.`);
  }

  log(LogLevel.DEBUG, 'Detecting proxy: No proxy detected');
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
