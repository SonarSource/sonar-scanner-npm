import { LogLevel } from './logging';

export type PlatformInfo = {
  // TODO: Use enum(?)
  os: string;
  arch: string;
};

export type JreMetaData = {
  filename: string;
  checksum: string;
  javaPath: string;
};

export type ScannerLogEntry = {
  level: LogLevel;
  formattedMessage: string;
  throwable?: string;
};
