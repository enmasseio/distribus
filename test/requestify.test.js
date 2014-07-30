var assert = require('assert'),
    Promise = require('bluebird'),
    ws = require('ws'),
    WebSocket = ws,
    requestify = require('../lib/requestify');

function freeport () {
  return new Promise(function (resolve, reject) {
    var f = require('freeport');
    f(function (err, port) {
      err ? reject(err) : resolve(port);
    })
  });
}

describe('requestify', function() {

  it ('should send a request via a socket and receive a response', function () {
    var server, client;

    // get a free port
    return freeport()

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
  });

  it ('should send a notification via a socket (no response)', function (done) {
    var server, client;


    // get a free port
    freeport()

        // open a server
        .then(function (port) {
          return new Promise(function (resolve, reject) {
            server = new ws.Server({port: port});

            server.on('connection', function(client) {
              client = requestify(client);

              client.onrequest = function onrequest (message) {
                try {
                  assert.equal(message, 'This is a notification');
                }
                catch (err) {
                  done(err);
                }

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
                try {
                  assert.equal(response, null);
                  assert.ok(true, 'notification has been send');
                }
                catch (err) {
                  done(err);
                }
              })
              .catch(function (err) {
                try {
                  assert.ok(false, 'should not fail');
                }
                catch (err) {
                  done(err);
                }
              });
        })
  });

  // TODO: test errors, broken connection, etc

  // TODO: test notify

});
