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

import { spawn as nodeSpawn } from 'node:child_process';
import fsExtra from 'fs-extra';

/**
 * Injectable dependencies for testing.
 * This module provides default implementations that can be overridden in tests.
 */

export interface FsDeps {
  existsSync: typeof fsExtra.existsSync;
  readFileSync: typeof fsExtra.readFileSync;
  readFile: typeof fsExtra.readFile;
  remove: typeof fsExtra.remove;
  ensureDir: typeof fsExtra.ensureDir;
  mkdirSync: typeof fsExtra.mkdirSync;
  createReadStream: typeof fsExtra.createReadStream;
  createWriteStream: typeof fsExtra.createWriteStream;
  exists: typeof fsExtra.exists;
  promises: typeof fsExtra.promises;
}

export interface ProcessDeps {
  platform: NodeJS.Platform;
  arch: NodeJS.Architecture;
  env: NodeJS.ProcessEnv;
  cwd: () => string;
}

export type SpawnFn = typeof nodeSpawn;

export const defaultFsDeps: FsDeps = {
  existsSync: fsExtra.existsSync.bind(fsExtra),
  readFileSync: fsExtra.readFileSync.bind(fsExtra),
  readFile: fsExtra.readFile.bind(fsExtra),
  remove: fsExtra.remove.bind(fsExtra),
  ensureDir: fsExtra.ensureDir.bind(fsExtra),
  mkdirSync: fsExtra.mkdirSync.bind(fsExtra),
  createReadStream: fsExtra.createReadStream.bind(fsExtra),
  createWriteStream: fsExtra.createWriteStream.bind(fsExtra),
  exists: fsExtra.exists.bind(fsExtra),
  promises: fsExtra.promises,
};

export const defaultProcessDeps: ProcessDeps = {
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
};

export const defaultSpawn: SpawnFn = nodeSpawn;
