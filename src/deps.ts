/*
 * sonar-scanner-npm
 * Copyright (C) 2022-2025 SonarSource Sàrl
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

import { exec, spawn as nodeSpawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import fs from 'node:fs';
import util from 'node:util';
import { download as defaultDownload, fetch as defaultFetch } from './request';
import type { ScannerProperties, ScanOptions } from './types';

const execAsync = util.promisify(exec);

// Re-export spawn type (use typeof for compatibility with complex overloads)
export type SpawnFn = typeof nodeSpawn;

/**
 * Exec async function type for executing shell commands
 */
export type ExecAsyncFn = (command: string) => Promise<{ stdout: string; stderr: string }>;

/**
 * High-level function types for scan orchestration
 */
export type ServerSupportsJREProvisioningFn = (properties: ScannerProperties) => Promise<boolean>;
export type FetchJREFn = (properties: ScannerProperties) => Promise<string>;
export type DownloadScannerCliFn = (properties: ScannerProperties) => Promise<string>;
export type RunScannerCliFn = (
  scanOptions: ScanOptions,
  properties: ScannerProperties,
  binPath: string,
) => Promise<void>;
export type FetchScannerEngineFn = (properties: ScannerProperties) => Promise<string>;
export type RunScannerEngineFn = (
  javaPath: string,
  scannerEnginePath: string,
  scanOptions: ScanOptions,
  properties: ScannerProperties,
) => Promise<void>;
export type LocateExecutableFromPathFn = (executable: string) => Promise<string | null>;

/**
 * File utility function type
 */
export type ExtractArchiveFn = (archivePath: string, destPath: string) => Promise<void>;

/**
 * Centralized dependency container for all injectable dependencies.
 * This allows for easy mocking in tests while keeping function signatures clean.
 */
export interface Dependencies {
  // File system operations
  fs: {
    existsSync: typeof fs.existsSync;
    readFileSync: typeof fs.readFileSync;
    readFile: typeof fs.readFile;
    mkdirSync: typeof fs.mkdirSync;
    createReadStream: typeof fs.createReadStream;
    createWriteStream: typeof fs.createWriteStream;
    remove: (path: string) => Promise<void>;
    writeFile: (path: string, data: string) => Promise<void>;
    exists: (path: string) => Promise<boolean>;
    ensureDir: (path: string) => Promise<void>;
  };
  // Process information
  process: {
    platform: NodeJS.Platform;
    arch: NodeJS.Architecture;
    env: NodeJS.ProcessEnv;
    cwd: () => string;
  };
  // HTTP operations
  http: {
    fetch: typeof defaultFetch;
    download: typeof defaultDownload;
  };
  // Spawning child processes
  spawn: SpawnFn;
  // Executing shell commands
  execAsync: ExecAsyncFn;
  // High-level scan orchestration functions (lazily initialized to avoid circular deps)
  scan: {
    serverSupportsJREProvisioning: ServerSupportsJREProvisioningFn;
    fetchJRE: FetchJREFn;
    downloadScannerCli: DownloadScannerCliFn;
    runScannerCli: RunScannerCliFn;
    fetchScannerEngine: FetchScannerEngineFn;
    runScannerEngine: RunScannerEngineFn;
    locateExecutableFromPath: LocateExecutableFromPathFn;
  };
  // File utilities
  file: {
    extractArchive: ExtractArchiveFn;
  };
}

// Lazy-loaded modules to avoid circular dependencies
let javaModule: typeof import('./java') | null = null;
let scannerCliModule: typeof import('./scanner-cli') | null = null;
let scannerEngineModule: typeof import('./scanner-engine') | null = null;
let processModule: typeof import('./process') | null = null;
let fileModule: typeof import('./file') | null = null;

async function getJavaModule() {
  if (!javaModule) {
    javaModule = await import('./java');
  }
  return javaModule;
}

async function getScannerCliModule() {
  if (!scannerCliModule) {
    scannerCliModule = await import('./scanner-cli');
  }
  return scannerCliModule;
}

async function getScannerEngineModule() {
  if (!scannerEngineModule) {
    scannerEngineModule = await import('./scanner-engine');
  }
  return scannerEngineModule;
}

async function getProcessModule() {
  if (!processModule) {
    processModule = await import('./process');
  }
  return processModule;
}

async function getFileModule() {
  if (!fileModule) {
    fileModule = await import('./file');
  }
  return fileModule;
}

/**
 * Creates the default dependencies using real implementations.
 */
function createDefaultDeps(): Dependencies {
  return {
    fs: {
      existsSync: fs.existsSync,
      readFileSync: fs.readFileSync,
      readFile: fs.readFile,
      mkdirSync: fs.mkdirSync,
      createReadStream: fs.createReadStream,
      createWriteStream: fs.createWriteStream,
      remove: (filePath: string) => fs.promises.rm(filePath, { recursive: true, force: true }),
      writeFile: (filePath: string, data: string) => fs.promises.writeFile(filePath, data),
      exists: async (filePath: string) => {
        try {
          await fs.promises.access(filePath);
          return true;
        } catch {
          return false;
        }
      },
      ensureDir: (dirPath: string) =>
        fs.promises.mkdir(dirPath, { recursive: true }).then(() => {}),
    },
    process: {
      get platform() {
        return process.platform;
      },
      get arch() {
        return process.arch;
      },
      get env() {
        return process.env;
      },
      cwd: () => process.cwd(),
    },
    http: {
      fetch: defaultFetch,
      download: defaultDownload,
    },
    spawn: nodeSpawn,
    execAsync,
    scan: {
      serverSupportsJREProvisioning: async properties => {
        const mod = await getJavaModule();
        return mod.serverSupportsJREProvisioning(properties);
      },
      fetchJRE: async properties => {
        const mod = await getJavaModule();
        return mod.fetchJRE(properties);
      },
      downloadScannerCli: async properties => {
        const mod = await getScannerCliModule();
        return mod.downloadScannerCli(properties);
      },
      runScannerCli: async (scanOptions, properties, binPath) => {
        const mod = await getScannerCliModule();
        return mod.runScannerCli(scanOptions, properties, binPath);
      },
      fetchScannerEngine: async properties => {
        const mod = await getScannerEngineModule();
        return mod.fetchScannerEngine(properties);
      },
      runScannerEngine: async (javaPath, scannerEnginePath, scanOptions, properties) => {
        const mod = await getScannerEngineModule();
        return mod.runScannerEngine(javaPath, scannerEnginePath, scanOptions, properties);
      },
      locateExecutableFromPath: async executable => {
        const mod = await getProcessModule();
        return mod.locateExecutableFromPath(executable);
      },
    },
    file: {
      extractArchive: async (archivePath, destPath) => {
        const mod = await getFileModule();
        return mod.extractArchive(archivePath, destPath);
      },
    },
  };
}

// Module-level dependency container
let deps = createDefaultDeps();

/**
 * Get the current dependency container.
 * Internal functions use this to access dependencies.
 */
export function getDeps(): Dependencies {
  return deps;
}

/**
 * Set/override dependencies. Used for testing.
 * Merges the provided partial dependencies with the defaults.
 *
 * @param newDeps - Partial dependencies to override
 */
export function setDeps(newDeps: Partial<Dependencies>): void {
  const defaults = createDefaultDeps();
  deps = {
    ...defaults,
    ...newDeps,
    // Deep merge nested objects
    fs: {
      ...defaults.fs,
      ...newDeps.fs,
    },
    process: {
      ...defaults.process,
      ...newDeps.process,
    },
    http: {
      ...defaults.http,
      ...newDeps.http,
    },
    scan: {
      ...defaults.scan,
      ...newDeps.scan,
    },
    file: {
      ...defaults.file,
      ...newDeps.file,
    },
  };
}

/**
 * Reset dependencies to defaults. Should be called in afterEach() in tests.
 */
export function resetDeps(): void {
  deps = createDefaultDeps();
}
