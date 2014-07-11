var assert = require('assert'),
    freeport = require('freeport'),
    Promise = require('native-promise-only'),
    ws = require('ws'),
    WebSocket = require('../lib/WebSocket'),
    requestify = require('../lib/requestify');

// TODO: use https://www.npmjs.org/package/mocha-as-promised

describe('requestify', function() {

  it ('should send a request via a socket and receive a response', function (done) {
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

  it ('should send a notification via a socket (no response)', function (done) {
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
                assert.equal(message, 'This is a notification');

                client.close();
                server.close();

                done();
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

        // send a notification
        .then(function () {
          client.notify('This is a notification')
              .then(function (response) {
                assert.equal(response, null);
                assert.ok(true, 'notification has been send');
              })
              .catch(function (err) {
                assert.ok(false, 'should not fail');
              });
        })
  });

  // TODO: test errors, broken connection, etc

  // TODO: test notify

});
