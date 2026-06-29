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

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Starts a server that listens on the provided port and answers with a zipped executable (Windows, Unix compatible)
 *
 * @param {*} port
 * @returns
 */
export function startServer(port = 0) {
  const pathToZip = path.join(currentDir, 'executable.zip');
  const zipFileContent = fs.readFileSync(pathToZip);

  return new Promise((accept, reject) => {
    const server = http.createServer(requestListener);
    server.listen(port, '127.0.0.1', () => {
      accept(server);
    });
    server.on('error', error => {
      reject(error);
    });
  });

  function requestListener(req, res) {
    const resBody = zipFileContent;

    res.setHeader('Content-length', resBody.length);
    res.writeHead(200);
    res.end(resBody);
  }
}

export function closeServerPromise(server) {
  return new Promise((resolve, reject) => {
    server.close(() => {
      resolve();
    });
    server.on('error', error => {
      reject(error);
    });
  });
}
