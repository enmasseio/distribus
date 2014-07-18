var assert = require('assert'),
    Promise = require('native-promise-only'),
    Peer = require('../lib/Peer');

describe('Peer', function () {

  it('should receive a message', function (done) {
    var RECIPIENT = 'peer1';
    var SENDER = 'peer2';
    var MESSAGE = 'Hello world!';

    var peer1 = new Peer(RECIPIENT);

    peer1.on('message', function (sender, message) {
      try {
        assert.equal(sender, SENDER);
        assert.equal(message, MESSAGE);
      }
      catch (err) {
        done(err);
      }

      done();
    });

    peer1.emit('message', SENDER, MESSAGE);
  });

  it('should send a message', function (done) {
    var RECIPIENT = 'peer1';
    var SENDER = 'peer2';
    var MESSAGE = 'Hello world!';

    var send = function (sender, recipient, message) {
      return new Promise(function (resolve, reject) {
        try {
          assert(sender, SENDER);
          assert(recipient, RECIPIENT);
          assert(message, MESSAGE);
        }
        catch (err) {
          done(err);
        }

        resolve(null);

        done();
      });
    };

    var peer2 = new Peer(SENDER, send);

    peer2.send(RECIPIENT, MESSAGE);
  });

  it('should return a promise on sending a message', function (done) {
    var RECIPIENT = 'peer1';
    var SENDER = 'peer2';
    var MESSAGE = 'Hello world!';

    var send = function (sender, recipient, message) {
      return new Promise(function (resolve, reject) {
        try {
          assert(sender, SENDER);
          assert(recipient, RECIPIENT);
          assert(message, MESSAGE);
        }
        catch (err) {
          done(err);
        }

        resolve(null);
      });
    };

    var peer2 = new Peer(SENDER, send);

    var promise = peer2.send(RECIPIENT, MESSAGE);
    assert(promise instanceof Promise);
    done();
  });

});