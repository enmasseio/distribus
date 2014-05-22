var assert = require('assert'),
    Promise = require('native-promise-only'),
    requestify = require('../lib/requestify'),
    Host = require('../lib/Host'),
    Peer = require('../lib/Peer'),
    WebSocket = require('../lib/WebSocket');


function freeport () {
  return new Promise(function (resolve, reject) {
    var f = require('freeport');
    f(function (err, port) {
      err ? reject(err) : resolve(port);
    })
  });
}

describe('Host', function () {

  it('should create a peer', function (done) {
    var PEER1 = 'peer1';
    var host = new Host();

    host.create(PEER1).then(function (peer1) {
      assert(peer1 instanceof Peer);
      assert.equal(peer1.id, PEER1);
      assert.deepEqual(Object.keys(host.peers), [PEER1]);

      done();
    });
  });

  it('should throw an error when creating a peer one id twice', function (done) {
    var PEER1 = 'peer1';
    var host = new Host();

    host.create(PEER1).then(function (peer1) {
      host.create(PEER1)
          .then(function () {
            assert.ok(false, 'should not be created twice');
          })
          .catch(function (err) {
            assert.equal(err.toString(), 'Error: Id already exists (id: peer1)');
            done();
          });

    });
  });

  it('should remove a peer by instance', function () {
    var PEER1 = 'peer1';
    var host = new Host();

    host.create(PEER1).then(function (peer1) {
      assert.deepEqual(Object.keys(host.peers), [PEER1]);

      host.remove(peer1).then(function () {
        assert.deepEqual(Object.keys(host.peers), []);
        done();
      });
    });
  });

  it('should remove a peer by id', function () {
    var PEER1 = 'peer1';
    var host = new Host();

    host.create(PEER1).then(function (peer1) {
      assert.deepEqual(Object.keys(host.peers), [PEER1]);

      host.remove(PEER1).then(function () {
        assert.deepEqual(Object.keys(host.peers), []);
        done();
      });
    });
  });

  it('should ignore undefined peer in function remove', function () {
    var PEER1 = 'peer1';
    var host = new Host();

    host.create(PEER1).then(function (peer1) {
      assert.deepEqual(Object.keys(host.peers), [PEER1]);

      host.remove().then(function () {
        assert.deepEqual(Object.keys(host.peers), [PEER1]);
        done();
      });
    });
  });

  it('should send a message from one peer to another', function (done) {
    var PEER1 = 'peer1';
    var PEER2 = 'peer2';
    var MESSAGE = 'Hello world!';
    var host = new Host();

    Promise.all([host.create(PEER1), host.create(PEER2)])
        .then(function (peers) {
          var peer1 = peers[0];
          var peer2 = peers[1];

          peer1.on('message', function (sender, message) {
            assert.equal(sender, PEER2);
            assert.equal(message, MESSAGE);
            done();
          });

          peer2.send(PEER1, MESSAGE);
        });
  });

  it('should receive a confirmation after a message is sent', function (done) {
    var PEER1 = 'peer1';
    var PEER2 = 'peer2';
    var MESSAGE = 'Hello world!';
    var host = new Host();

    Promise.all([host.create(PEER1), host.create(PEER2)])
        .then(function (peers) {
          var peer1 = peers[0];
          var peer2 = peers[1];

          peer2.send(PEER1, MESSAGE)
              .then(function (confirm) {
                assert.strictEqual(confirm, null);
                done();
              });
        });
  });

  it('should receive an error sending a message failed', function (done) {
    var PEER1 = 'peer1';
    var PEER2 = 'peer2'; // a non-existing peer
    var MESSAGE = 'Hello world!';
    var host = new Host();

    host.create(PEER1)
        .then(function (peer1) {
          peer1.send(PEER2, MESSAGE)
              .then(function (confirm) {
                assert.ok(false, 'should not succeed')
              })
              .catch(function (err) {
                assert.equal(err.toString(), 'Error: Peer not found (id: peer2)');
                done();
              });
        });
  });

  it('should send a message to the server', function (done) {
    var ADDRESS = '127.0.0.1',
        host = new Host();

    freeport()
        .then(function (PORT) {
          host.listen(ADDRESS, PORT).then(function () {
            var client = new WebSocket('ws://' + ADDRESS + ':' + PORT);
            requestify(client);

            client.onopen = function () {
              var request = {method: 'ping', params: 'hello world'};

              client.request(request)
                  .then(function (response) {
                    assert.deepEqual(response, {result: 'hello world', error: null});

                    client.close();
                    host.close();

                    done();
                  });
            }
          })
        });
  });

  it('should return an error when an unknown message is sent to the server', function (done) {
    var ADDRESS = '127.0.0.1',
        host = new Host();

    freeport()
        .then(function (PORT) {
          host.listen(ADDRESS, PORT).then(function () {
            var client = new WebSocket('ws://' + ADDRESS + ':' + PORT);
            requestify(client);

            client.onopen = function () {
              var request = {method: 'foo', params: 'hello world'};

              client.request(request)
                  .then(function (response) {
                    assert.ok(false, 'should not resolve');
                  })
                  .catch(function (err) {
                    assert(/Unknown method/.test(err.toString()));
                    done();
                  });
            }
          })
        });
  });

});