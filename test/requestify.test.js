var assert = require('assert'),
    freeport = require('freeport'),
    Promise = require('native-promise-only'),
    ws = require('ws'),
    WebSocket = require('../lib/WebSocket'),
    requestify = require('../lib/requestify');

describe('requestify', function() {

  it ('should turn a socket in a request/response channel', function (done) {
    var server, client;

    // get a free port
    new Promise(function (resolve, reject) {
      freeport(function (err, port) {
        err ? reject(err) : resolve(port);
      })
    })

        // open a server
        .then(function (port) {
          return new Promise(function (resolve, reject) {
            server = new ws.Server({port: port});

            server.on('connection', function(client) {
              client = requestify(client);

              client.onrequest = function onrequest (message) {
                return new Promise(function (resolve, reject) {
                  resolve(message);
                })
              };
            });

            resolve(port);
          });
        })

        // open a client
        .then(function (port) {
          return new Promise(function (resolve, reject) {
            client = requestify(new WebSocket('ws://localhost:' + port));

            client.onopen = resolve;
          });
        })

        // send a string
        .then(function () {
          return client.request('hello there!')
              .then(function (data) {
                assert.equal(data, 'hello there!');
              })
              .catch(function (err) {
                assert.ok(false, 'should not fail');
              });
        })

        // send a JSON object
        .then(function () {
          return client.request({message: 'hello there!', id: 123})
              .then(function (data) {
                assert.deepEqual(data, {message: 'hello there!', id: 123});
              })
              .catch(function (err) {
                assert.ok(false, 'should not fail');
              });
        })

        // close client and server
        .then(function () {
          client.close();
          server.close();
        })

        .then(done);
  });

});
