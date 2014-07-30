var assert = require('assert'),
    Promise = require('bluebird'),
    Peer = require('../lib/Peer');

describe('Peer', function () {

  it('should receive a message', function (done) {
    var TO = 'peer1';
    var FROM = 'peer2';
    var MESSAGE = 'Hello world!';

    var peer1 = new Peer(TO);

    peer1.on('message', function (from, message) {
      try {
        assert.equal(from, FROM);
        assert.equal(message, MESSAGE);
      }
      catch (err) {
        done(err);
      }

      done();
    });

    peer1.emit('message', FROM, MESSAGE);
  });

  it('should send a message', function (done) {
    var TO = 'peer1';
    var FROM = 'peer2';
    var MESSAGE = 'Hello world!';

    var send = function (from, to, message) {
      return new Promise(function (resolve, reject) {
        try {
          assert(from, FROM);
          assert(to, TO);
          assert(message, MESSAGE);
        }
        catch (err) {
          done(err);
        }

        resolve(null);

        done();
      });
    };

    var peer2 = new Peer(FROM, send);

    peer2.send(TO, MESSAGE);
  });

  it('should return a promise on sending a message', function (done) {
    var TO = 'peer1';
    var FROM = 'peer2';
    var MESSAGE = 'Hello world!';

    var send = function (from, to, message) {
      return new Promise(function (resolve, reject) {
        try {
          assert(from, FROM);
          assert(to, TO);
          assert(message, MESSAGE);
        }
        catch (err) {
          done(err);
        }

        resolve(null);
      });
    };

    var peer2 = new Peer(FROM, send);

    var promise = peer2.send(TO, MESSAGE);
    assert(promise instanceof Promise);
    done();
  });

});