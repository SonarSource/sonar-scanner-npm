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
