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

import { type ScannerProperties, ScannerProperty } from './types.js';

export const REDACTED_VALUE = '[HIDDEN]';

const SENSITIVE_PROPERTY_NAMES = new Set(['sonar.login']);
const SENSITIVE_PROPERTY_PATTERN = /(password|passwd|token|secret|credentials?)(?:$|[._-])/i;

function isSensitiveProperty(key: string): boolean {
  return SENSITIVE_PROPERTY_NAMES.has(key) || SENSITIVE_PROPERTY_PATTERN.test(key);
}

export function redactUrl(value: string | URL): string {
  const urlValue = value.toString();
  try {
    const url = value instanceof URL ? value : new URL(value);
    if (!url.username && !url.password) {
      return urlValue;
    }

    const href = url.href;
    const authorityStart = href.indexOf('//') + 2;
    const userInfoEnd = href.indexOf('@', authorityStart);
    return `${href.slice(0, authorityStart)}${REDACTED_VALUE}${href.slice(userInfoEnd)}`;
  } catch {
    return urlValue;
  }
}

function redactPropertyValue(key: string, value: string): string {
  if (isSensitiveProperty(key)) {
    return REDACTED_VALUE;
  }
  if (key === ScannerProperty.SonarScannerJavaOptions) {
    return redactArguments(value.split(' ')).join(' ');
  }
  return redactUrl(value);
}

export function redactProperties(properties: ScannerProperties): ScannerProperties {
  return Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [key, redactPropertyValue(key, value)]),
  );
}

export function redactArguments(args: string[]): string[] {
  return args.map(argument => {
    const separator = argument.indexOf('=');
    if (separator === -1) {
      return redactUrl(argument);
    }

    const prefixAndKey = argument.slice(0, separator);
    const key = prefixAndKey.replace(/^-D/, '');
    const value = argument.slice(separator + 1);
    return [prefixAndKey, isSensitiveProperty(key) ? REDACTED_VALUE : redactUrl(value)].join('=');
  });
}
