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

let logLevel = DEFAULT_LOG_LEVEL;

export function log(level: LogLevel, ...message: unknown[]) {
  if (logLevelValues[level] <= logLevelValues[logLevel]) {
    console.log(`[${level}] Bootstrapper:: `, ...message);
  }
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
