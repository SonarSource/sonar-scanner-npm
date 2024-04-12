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

const fs = require('fs');
const path = require('path');

const LICENSE_HEADER = fs.readFileSync(path.resolve(__dirname, 'file-header.ts')).toString().trim();

// Read every .js file in the ../build directory
const directoryPath = path.resolve(__dirname, '../build/src');

const fileNames = fs.readdirSync(directoryPath);
for (const fileName of fileNames) {
  // Skip if not a .js file
  if (!fileName.endsWith('.js')) {
    continue;
  }

  // Read the file, drop the license header, re-prepend it and write the file
  const filePath = path.join(directoryPath, fileName);
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const fileWithoutHeader = fileContent.replace(LICENSE_HEADER, '');
  const newFileContent = `${LICENSE_HEADER}\n${fileWithoutHeader}`;

  fs.writeFileSync(filePath, newFileContent);
}
