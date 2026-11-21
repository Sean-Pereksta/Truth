'use strict';

const { Duplex } = require('node:stream');

// Exercise the real HTTP and WebSocket protocol without a listening port.
function socketPair() {
  let client, server;
  function makeSocket(peer) {
    return new Duplex({
      read() {},
      write(bytes, _encoding, done) {
        const copy = Buffer.from(bytes);
        queueMicrotask(() => {
          if (!peer().destroyed) peer().push(copy);
          done();
        });
      },
      final(done) {
        if (!peer().destroyed) peer().push(null);
        done();
      },
      destroy(error, done) {
        if (!peer().destroyed) peer().push(null);
        done(error);
      }
    });
  }
  client = makeSocket(() => server);
  server = makeSocket(() => client);
  return { client, server };
}

module.exports = { socketPair };
