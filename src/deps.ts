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

import { exec, spawn } from 'node:child_process';
import fs from 'node:fs';
import util from 'node:util';
import { extractArchive } from './file';
import { fetchJRE, serverSupportsJREProvisioning } from './java';
import { locateExecutableFromPath } from './process';
import { download as defaultDownload, fetch as defaultFetch } from './request';
import { downloadScannerCli, runScannerCli } from './scanner-cli';
import { fetchScannerEngine, runScannerEngine } from './scanner-engine';
const execAsync = util.promisify(exec);

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
  spawn: typeof spawn;
  // Executing shell commands
  execAsync: typeof execAsync;
  // High-level scan orchestration functions
  scan: {
    serverSupportsJREProvisioning: typeof serverSupportsJREProvisioning;
    fetchJRE: typeof fetchJRE;
    downloadScannerCli: typeof downloadScannerCli;
    runScannerCli: typeof runScannerCli;
    fetchScannerEngine: typeof fetchScannerEngine;
    runScannerEngine: typeof runScannerEngine;
    locateExecutableFromPath: typeof locateExecutableFromPath;
  };
  // File utilities
  file: {
    extractArchive: typeof extractArchive;
  };
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
    spawn,
    execAsync,
    scan: {
      serverSupportsJREProvisioning,
      fetchJRE,
      downloadScannerCli,
      runScannerCli,
      fetchScannerEngine,
      runScannerEngine,
      locateExecutableFromPath,
    },
    file: {
      extractArchive,
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
