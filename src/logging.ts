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

export enum LogLevel {
  TRACE = 'TRACE',
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

const logLevelValues = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4,
};

const DEFAULT_LOG_LEVEL = LogLevel.INFO;
const LOG_MESSAGE_PADDING = 7;

let logLevel = DEFAULT_LOG_LEVEL;

export function log(level: LogLevel, ...message: unknown[]) {
  logWithPrefix(level, 'Bootstrapper', ...message);
}

export function logWithPrefix(level: LogLevel, prefix: string, ...message: unknown[]) {
  if (logLevelValues[level] > logLevelValues[logLevel]) {
    return;
  }

  const levelStr = `[${level}]`.padEnd(LOG_MESSAGE_PADDING);
  console.log(levelStr, `${prefix}:`, ...message);
}

export function getLogLevel() {
  return logLevel;
}

function stringToLogLevel(level: string): LogLevel {
  switch (level.toUpperCase()) {
    case 'ERROR':
      return LogLevel.ERROR;
    case 'WARN':
      return LogLevel.WARN;
    case 'INFO':
      return LogLevel.INFO;
    case 'DEBUG':
      return LogLevel.DEBUG;
    case 'TRACE':
      return LogLevel.TRACE;
    default:
      log(LogLevel.WARN, `Invalid log level: ${level}`);
      return DEFAULT_LOG_LEVEL;
  }
}

export function setLogLevel(level: string) {
  logLevel = stringToLogLevel(level);
}
