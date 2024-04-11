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

const directoryPath = path.resolve(__dirname, '../build');

fs.readdirSync(directoryPath).forEach(file => {
  const filePath = path.join(directoryPath, file);
  const fileContent = fs.readFileSync(filePath, 'utf8');

  const commentStart = fileContent.indexOf('/*');
  const commentEnd = fileContent.indexOf('*/', commentStart) + 2; // +2 to include the end of the comment

  if (commentStart > 0 && commentEnd > 0) {
    const beforeComment = fileContent.slice(0, commentStart);
    const comment = fileContent.slice(commentStart, commentEnd);
    const afterComment = fileContent.slice(commentEnd);

    const newFileContent = comment + '\n' + beforeComment + afterComment;

    fs.writeFileSync(filePath, newFileContent);
  }
});
