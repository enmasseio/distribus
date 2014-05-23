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

      host.remove(peer1).then(function (result) {
        assert.strictEqual(result, null);
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

      host.remove(PEER1).then(function (result) {
        assert.strictEqual(result, null);
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

      host.remove().then(function (result) {
        assert.strictEqual(result, null);
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

  it('should receive an error when sending a message failed', function (done) {
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
    var ADDRESS = '127.0.0.1';

    freeport()
        .then(function (PORT) {
          var host = new Host();
          host.listen(ADDRESS, PORT).then(function (h) {
            assert(h === host);
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

  // TODO: test whether closing a host actually closes the socket.
  // TODO: test whether closing a listening host returns the host itself
  // TODO: test whether closing a non-listening host returns the host itself

  it('should return an error when an unknown message is sent to the server', function (done) {
    var ADDRESS = '127.0.0.1';

    freeport()
        .then(function (PORT) {
          new Host().listen(ADDRESS, PORT).then(function (host) {
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

  describe('host api', function () {
    // TODO: neatly test the hosts socket api
  });

  describe('network', function () {
    var ADDRESS = '127.0.0.1';
    var host1 = null;
    var host2 = null;
    var url1 = null;
    var url2 = null;
    var peer1 = null;
    var peer2 = null;

    beforeEach(function (done) {
      // create hosts
      host1 = new Host();
      host2 = new Host();

      // find free ports
      Promise.all([freeport(), freeport()])

          // open hosts
          .then(function (ports) {
            return Promise.all([
              host1.listen(ADDRESS, ports[0]),
              host2.listen(ADDRESS, ports[1])
            ]);
          })

          // create peers
          .then(function () {
            return Promise.all([
              host1.create('peer1'),
              host2.create('peer2')
            ]);
          })

          .then(function (peers) {
            peer1 = peers[0];
            peer2 = peers[1];

            url1 = 'ws://' + host1.address + ':' + host1.port;
            url2 = 'ws://' + host2.address + ':' + host2.port;

            done();
          });
    });

    afterEach(function (done) {
      // close the hosts
      var hosts = [];
      if(host1) hosts.push(host1.close());
      if(host2) hosts.push(host2.close());

      Promise.all(hosts)
          .then(function () {
            host1 = null;
            host2 = null;
            url1 = null;
            url2 = null;
            peer1 = null;
            peer2 = null;

            done();
          });
    });

    it('should join two hosts with each other', function (done) {
      host1.join(url2)
          .then(function () {
            assert.deepEqual(Object.keys(host1.connections), [url2]);
            assert.deepEqual(Object.keys(host2.connections), [url1]);

            done();
          })
    });

    it('hosts should gracefully leave the network on leave', function (done) {
      host1.join(url2)
          .then(function () {
            assert.deepEqual(Object.keys(host1.connections), [url2]);
            assert.deepEqual(Object.keys(host2.connections), [url1]);

            return host2.close();
          })
          .then(function () {
            assert.deepEqual(Object.keys(host1.connections), []);
            assert.deepEqual(Object.keys(host2.connections), []);

            done();
          });
    });

    it('should find a peer located on the host itself', function (done) {
      host1.find('peer1')
          .then(function (url) {
            assert.equal(url, host1.url);
            assert.deepEqual(host1.addresses, {});
            done();
          });
    });

    it('should find a peer located on the host itself when host has no url', function (done) {
      var host = new Host();
      host.create('peer1')
          .then(function () {
            host.find('peer1')
                .then(function (url) {
                  assert.equal(url, null);
                  assert.deepEqual(host.addresses, {});
                  done();
                });
          })
    });

    it('should find a peer located on an other host', function (done) {
      // join the hosts
      host1.join(url2)

          // find a peer located on host2 via host1
          .then(function () {
            return host1.find('peer2').then(function (url) {
              assert.equal(url, host2.url);
              assert.deepEqual(host1.addresses, {peer2: host2.url});
            });
          })

          // done
          .then(function () {
            done();
          });
    });

    it('should throw an error when a peer is not found', function (done) {
      // join the hosts
      host1.find('non-existing-peer')
          .then(function (url) {
            assert.ok(false, 'should not resolve');
          })
          .catch(function (err) {
            assert.equal(err.toString(), 'Error: Peer not found (id: non-existing-peer)');
            done();
          })
    });

    it('should send a message to a peer located on another host', function (done) {
      // join the hosts
      host1.join(url2)
          // send a message from one peer to another
          .then(function () {
            return new Promise(function (resolve, reject) {
              peer2.on('message', function (sender, message) {
                assert.equal(sender, 'peer1');
                assert.equal(message, 'hello peer2');

                done()
              });

              peer1.send('peer2', 'hello peer2');
            });
          })
    });

    it('should send a message to an peer on other host and receive a message', function (done) {
      // join the hosts
      host1.join(url2)
          // send a message from one peer to another
          .then(function () {
            return new Promise(function (resolve, reject) {
              peer2.on('message', function (from, message) {
                assert.equal(from, 'peer1');
                assert.equal(message, 'hello peer2');

                peer2.send(from, 'hi there');
              });

              peer1.on('message', function (sender, message) {
                assert.equal(sender, 'peer2');
                assert.equal(message, 'hi there');

                done()
              });

              peer1.send('peer2', 'hello peer2');
            });
          })
    });

  });

});