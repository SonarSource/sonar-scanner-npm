/*
 * sonar-scanner-npm
 * Copyright (C) 2022-2022 SonarSource SA
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
const http = require('http');

/**
 * Starts a server that listens on the provided port and answers with a simple shell command
 * The requestCallback will be called on the request object, used to run assertions on the request
 *
 * @param {*} requestCallback
 * @param {*} port
 * @returns
 */
module.exports.startServer = function (requestCallback = () => {}, port = 0) {
  return new Promise((accept, reject) => {
    const server = http.createServer(requestListener);
    console.log('startin server on port', port);
    server.listen(port, '127.0.0.1', () => {
      accept(server);
    });
    server.on('error', error => {
      reject(error);
    });
  });

  function requestListener(req, res) {
    console.log('got request', req.headers, req.url);
    requestCallback(req);

    const resBody = 'echo "hello"';

    res.setHeader('Content-length', resBody.length);
    res.writeHead(200);
    res.end(resBody);
  }
};

module.exports.closeServerPromise = function (server) {
  const promise = new Promise((resolve, reject) => {
    server.close(() => {
      console.log('closed');
      resolve();
    });
  });
  server.on('error', error => {
    reject(error);
  });
  return promise;
};
