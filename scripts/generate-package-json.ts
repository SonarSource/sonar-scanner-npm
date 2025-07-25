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
import * as path from 'path';
import * as toml from 'toml';
import { ensureDir, readJson, writeJson } from 'fs-extra';
import { readFile } from 'node:fs/promises';

async function main() {
  // Paths
  const rootDir = process.cwd();
  const packageJsonPath = path.join(rootDir, 'package.json');
  const tomlPath = path.join(rootDir, '.pmgrc.toml');
  const buildDir = path.join(rootDir, 'build');
  const buildPackageJsonPath = path.join(buildDir, 'package.json');

  const packageJson = await readJson(packageJsonPath);

  const keysToKeep = [
    'name',
    'version',
    'description',
    'main',
    'types',
    'keywords',
    'homepage',
    'bugs',
    'bin',
    'engines',
    'dependencies',
  ];
  const filteredPackageJson: Record<string, any> = {};

  for (const key of keysToKeep) {
    if (key in packageJson) {
      filteredPackageJson[key] = packageJson[key];
    }
  }

  const tomlContent = await readFile(tomlPath, 'utf-8');
  const tomlData = toml.parse(tomlContent);

  // Merge TOML [data] into package.json
  Object.assign(filteredPackageJson, tomlData.data);

  await ensureDir(buildDir);
  await writeJson(buildPackageJsonPath, filteredPackageJson, { spaces: 2 });

  console.log(`Generated ${buildPackageJsonPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
