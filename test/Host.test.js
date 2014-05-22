var assert = require('assert'),
    Promise = require('native-promise-only'),
    Host = require('../lib/Host'),
    Peer = require('../lib/Peer');

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

});