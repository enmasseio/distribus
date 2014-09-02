var assert = require('assert');
var WebSocket = require('ws');
var WebSocketServer = require('ws').Server;
var Promise = require('bluebird');
var requestify = require('../lib/requestify');
var Host = require('../lib/Host');
var Peer = require('../lib/Peer');

function freeport () {
  return new Promise(function (resolve, reject) {
    var f = require('freeport');
    f(function (err, port) {
      err ? reject(err) : resolve(port);
    })
  });
}

describe('Host', function () {

  it('should set config options at construction', function () {
    var options = {
      reconnectTimeout: 1000,
      reconnectDelay: 100,
      reconnectDecay: 1
    };
    var host = new Host(options);

    assert.deepEqual(host.config(), options);

  });

  it('should get and set config options via Host.config', function () {
    var host = new Host();

    var options = {
      reconnectTimeout: 1000,
      reconnectDelay: 100,
      reconnectDecay: 2
    };

    host.config(options);

    assert.deepEqual(host.config(), options);
  });

  it('should create a peer', function () {
    var PEER1 = 'peer1';
    var host = new Host();
    var peer1 = host.create(PEER1);

    assert(peer1 instanceof Peer);
    assert.equal(peer1.id, PEER1);
    assert.deepEqual(Object.keys(host.peers), [PEER1]);
  });

  it('should throw an error when creating a peer one id twice', function () {
    var PEER1 = 'peer1';
    var host = new Host();

    host.create(PEER1);

    assert.throws(function () {
      host.create(PEER1);
    }, /Error: Id already exists \(id: peer1\)/);
  });

  it('should remove a peer by instance', function () {
    var PEER1 = 'peer1';
    var host = new Host();

    var peer1 = host.create(PEER1);

    assert.deepEqual(Object.keys(host.peers), [PEER1]);

    host.remove(peer1);

    assert.deepEqual(Object.keys(host.peers), []);
  });

  it('should remove a peer by id', function () {
    var PEER1 = 'peer1';
    var host = new Host();

    host.create(PEER1);
    assert.deepEqual(Object.keys(host.peers), [PEER1]);

    host.remove(PEER1);
    assert.deepEqual(Object.keys(host.peers), []);
  });

  it('should ignore undefined peer in function remove', function () {
    var host = new Host();
    host.remove();
  });

  it('should get a peer by its id', function () {
    var host = new Host();
    var PEER1 = 'peer1';
    var peer1 = host.create(PEER1);

    assert.strictEqual(host.get(PEER1), peer1);
  });

  it('should return null when getting a non existing peer', function () {
    var host = new Host();
    var PEER1 = 'nonexisting';
    assert.strictEqual(host.get(PEER1), null);
  });

  it('should send a message from one peer to another', function (done) {
    var PEER1 = 'peer1';
    var PEER2 = 'peer2';
    var MESSAGE = 'Hello world!';
    var host = new Host();
    var peer1 = host.create(PEER1);
    var peer2 = host.create(PEER2);

    peer1.on('message', function (from, message) {
      try {
        assert.equal(from, PEER2);
        assert.equal(message, MESSAGE);
      }
      catch (err) {
        done(err);
      }
      done();
    });

    peer2.send(PEER1, MESSAGE);
  });

  it('should receive a confirmation after a message is sent', function () {
    var PEER1 = 'peer1';
    var PEER2 = 'peer2';
    var MESSAGE = 'Hello world!';
    var host = new Host();
    var peer1 = host.create(PEER1);
    var peer2 = host.create(PEER2);

    return peer2.send(PEER1, MESSAGE)
        .then(function (confirm) {
          assert.strictEqual(confirm, null);
        });
  });

  it('should receive an error when sending a message failed', function () {
    var PEER1 = 'peer1';
    var PEER2 = 'peer2'; // a non-existing peer
    var MESSAGE = 'Hello world!';
    var host = new Host();
    var peer1 = host.create(PEER1);

    return peer1.send(PEER2, MESSAGE)
        .then(function (confirm) {
          assert.ok(false, 'should not succeed')
        })
        .catch(function (err) {
          assert.equal(err.toString(), 'Error: Peer not found (id: peer2)');
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
                    try {
                      assert.deepEqual(response, {result: 'hello world', error: null});
                    }
                    catch (err) {
                      done(err);
                    }

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
                    try {
                      assert.ok(false, 'should not resolve');
                    } catch (err) {
                      done(err)
                    }
                  })
                  .catch(function (err) {
                    try {
                      assert(/Unknown method/.test(err.toString()));
                    } catch (err) {
                      done(err)
                    }

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
    var hosts = [];
    var urls = [];
    var peers = [];
    var count = 4; // create 4 hosts and 4 peers

    beforeEach(function () {
      // create hosts
      while (hosts.length < count) hosts.push(new Host());

      // find free ports
      return Promise.all(hosts.map(function () {return freeport()}))

          // open hosts
          .then(function (ports) {
            return Promise.all(hosts.map(function (host, i) {return host.listen(ADDRESS, ports[i])}));
          })

          // create peers
          .then(function () {
            peers = hosts.map(function (host, i) {
              return host.create('peer' + i)
            });

            urls = hosts.map(function (host) {return 'ws://' + host.address + ':' + host.port;});
          });
    });

    afterEach(function () {
      // close the hosts
      return Promise.all(hosts.map(function (host) {host.close()}))
          .then(function () {
            hosts = [];
            peers= [];
            urls = [];
          });
    });

    it('should join two hosts with each other', function () {
      return hosts[0].join(urls[1])
          .then(function () {
            assert.deepEqual(Object.keys(hosts[0].connections), [urls[1]]);
            assert.deepEqual(Object.keys(hosts[1].connections), [urls[0]]);
          })
    });

    it('should join two hosts with each other with a networkId', function () {
      hosts[0].networkId = 'foo';
      hosts[1].networkId = 'foo';
      return hosts[0].join(urls[1])
          .then(function () {
            assert.deepEqual(Object.keys(hosts[0].connections), [urls[1]]);
            assert.deepEqual(Object.keys(hosts[1].connections), [urls[0]]);
          })
    });

    it('should reject joining two hosts with a differing networkId', function () {
      hosts[0].networkId = 'foo';
      hosts[1].networkId = 'bar';
      return hosts[0].join(urls[1])
          .then(function () {
            assert.ok(false, 'should not resolve');
          })
          .catch(function (err) {
            assert.equal(err.toString(), 'Error: Network id mismatch (foo !== bar)');
            assert.equal(hosts[0].networkId, 'foo');
            assert.equal(hosts[1].networkId, 'bar');
            assert.equal(Object.keys(hosts[0].connections).length, 0);
            assert.equal(Object.keys(hosts[1].connections).length, 0);
          })
    });

    it('should inherit networkId of joined host', function () {
      hosts[0].networkId = null; // undefined networkId
      hosts[1].networkId = 'foo';
      return hosts[0].join(urls[1])
          .then(function () {
            assert.equal(hosts[0].networkId, 'foo');
            assert.equal(hosts[1].networkId, 'foo');
          })
    });

    it('should throw an error when trying to connect to a non-existing host', function () {
      return freeport()
          .then(function (port) {
            var deadUrl = 'ws://' + ADDRESS + ':' + port;
            return hosts[0].join(deadUrl);
          })
          .then(function () {
            assert.ok(false, 'join should not succeed');
          })
          .catch(function (err) {
            assert.equal(err.toString(), 'Error: connect ECONNREFUSED');
            assert.deepEqual(hosts[0].connections, {});
          });
    });

    it('should throw an error when trying listen at a non-free port', function () {
      var host = new Host();
      return host.listen(hosts[0].address, hosts[0].port)
          .then(function () {
            assert.ok(false, 'listen should not succeed');
          })
          .catch(function (err) {
            assert.equal(err.toString(), 'Error: listen EADDRINUSE');
          });
    });

    it('should join three hosts with each other (1)', function () {
      return hosts[1].join(urls[0])
          .then(function () {
            // host1 and host0 are connected

            return hosts[2].join(urls[0]);
          })
          .then(function () {
            // host2 and host0 are connected -> host2 and host1 should be connected as well
            assert.deepEqual(Object.keys(hosts[0].connections).sort(), [urls[1], urls[2]].sort());
            assert.deepEqual(Object.keys(hosts[1].connections).sort(), [urls[0], urls[2]].sort());
            assert.deepEqual(Object.keys(hosts[2].connections).sort(), [urls[0], urls[1]].sort());
          })
    });

    it('should join three hosts with each other (2)', function () {
      return hosts[0].join(urls[1])
          .then(function () {
            // host0 and host1 are connected

            return hosts[1].join(urls[2]);
          })
          .then(function () {
            // host1 and host2 are connected -> host0 and host2 should be connected as well
            assert.deepEqual(Object.keys(hosts[0].connections).sort(), [urls[1], urls[2]].sort());
            assert.deepEqual(Object.keys(hosts[1].connections).sort(), [urls[0], urls[2]].sort());
            assert.deepEqual(Object.keys(hosts[2].connections).sort(), [urls[0], urls[1]].sort());
          })
    });

    it('should join three hosts with each other (3)', function () {
      return Promise.all([
        hosts[1].join(urls[0]),
        hosts[2].join(urls[0])
      ])
          .then(function () {
            // all hosts should now be connected with each other
            assert.deepEqual(Object.keys(hosts[0].connections).sort(), [urls[1], urls[2]].sort());
            assert.deepEqual(Object.keys(hosts[1].connections).sort(), [urls[0], urls[2]].sort());
            assert.deepEqual(Object.keys(hosts[2].connections).sort(), [urls[0], urls[1]].sort());
          })
    });

    it('should join 2 networks of 2 hosts into 1 network with 4 hosts', function () {
      return Promise.all([
        hosts[0].join(urls[1]),
        hosts[2].join(urls[3])
      ])
          .then(function () {
            // host0 and host1 are connected,
            // and host2 and host3 are connected
            assert.deepEqual(Object.keys(hosts[0].connections).sort(), [urls[1]].sort());
            assert.deepEqual(Object.keys(hosts[1].connections).sort(), [urls[0]].sort());
            assert.deepEqual(Object.keys(hosts[2].connections).sort(), [urls[3]].sort());
            assert.deepEqual(Object.keys(hosts[3].connections).sort(), [urls[2]].sort());

            return hosts[1].join(urls[2]);
          })
          .then(function () {
            // each of the 4 hosts should be connected with each of the other hosts
            assert.deepEqual(Object.keys(hosts[0].connections).sort(), [urls[1], urls[2], urls[3]].sort());
            assert.deepEqual(Object.keys(hosts[1].connections).sort(), [urls[0], urls[2], urls[3]].sort());
            assert.deepEqual(Object.keys(hosts[2].connections).sort(), [urls[0], urls[1], urls[3]].sort());
            assert.deepEqual(Object.keys(hosts[3].connections).sort(), [urls[0], urls[1], urls[2]].sort());
          })
    });

    it('hosts should gracefully leave the network on leave', function () {
      return hosts[0].join(urls[1])
          .then(function () {
            assert.deepEqual(Object.keys(hosts[0].connections), [urls[1]]);
            assert.deepEqual(Object.keys(hosts[1].connections), [urls[0]]);

            return hosts[1].close();
          })
          .then(function () {
            assert.deepEqual(Object.keys(hosts[0].connections), []);
            assert.deepEqual(Object.keys(hosts[1].connections), []);
          });
    });

    it('hosts should forget peers from closed hosts', function () {
      // join the hosts
      return hosts[0].join(urls[1])

          // find peer1 located on host1 via host0
          .then(function () {
            return hosts[0].find('peer1')
          })

          .then(function (url) {
            assert.equal(url, hosts[1].url);
            assert.deepEqual(hosts[0].addresses, {peer1: hosts[1].url});
          })

          // close host1, host0 should forget peer1
          .then(function () {
            return hosts[1].close();
          })

          .then(function () {
            assert.deepEqual(hosts[0].addresses, {});
          })
    });

    it('hosts should not forget peers from non-gracefully disconnected hosts', function () {
      // join the hosts
      var host1url = hosts[1].url;
      return hosts[0].join(urls[1])
          // find peer1 located on host1 via host0
          .then(function () {
            return hosts[0].find('peer1')
          })

          .then(function (url) {
            assert.equal(url, hosts[1].url);
            assert.deepEqual(hosts[0].addresses, {peer1: hosts[1].url});

            assert.deepEqual(Object.keys(hosts[0].connections), [hosts[1].url]);
            assert.deepEqual(Object.keys(hosts[1].connections), [hosts[0].url]);
          })

          .then(function () {
            return new Promise(function (resolve, reject) {
              // now we hard close host1
              hosts[1].server.close();
              hosts[1].server = null;
              hosts[1].address = null;
              hosts[1].port = null;
              hosts[1].url = null;

              // wait for a while so we can be sure host0 will have closed the broken connection
              setTimeout(resolve, 100);
            })
          })

          .then(function () {
            assert.deepEqual(Object.keys(hosts[0].connections), []);
            assert.deepEqual(hosts[0].addresses, {peer1: host1url});
          })
    });

    it('should auto-reconnect when the connection closes', function () {
      var reconnectDelay = 200;
      hosts[0].config({ reconnectDelay: reconnectDelay });
      hosts[1].config({ reconnectDelay: reconnectDelay });

      // join the hosts
      return hosts[0].join(urls[1])
          // find peer1 located on host1 via host0
          .then(function () {
            return hosts[0].find('peer1')
          })
          .then(function () {
            return hosts[1].find('peer0')
          })
          .then(function () {
            assert.deepEqual(hosts[0].addresses, {peer1: hosts[1].url});
            assert.deepEqual(hosts[1].addresses, {peer0: hosts[0].url});

            // hard close the connection
            hosts[1].connections[hosts[0].url].close();

            // wait for a little while so the socket is closed on both sides
            return new Promise(function (resolve) {
              setTimeout(resolve, reconnectDelay / 2);
            });
          })
          .then(function () {
            // connections should be gone
            assert.deepEqual(Object.keys(hosts[0].connections), []);
            assert.deepEqual(Object.keys(hosts[1].connections), []);

            // peers should still be there
            assert.deepEqual(hosts[0].addresses, {peer1: hosts[1].url});
            assert.deepEqual(hosts[1].addresses, {peer0: hosts[0].url});

            return new Promise(function (resolve) {
              setTimeout(resolve, reconnectDelay); // (this delay adds up to the earlier delay/2)
            });
          })
          .then(function () {
            // now the hosts should be reconnected
            assert.deepEqual(Object.keys(hosts[0].connections), [hosts[1].url]);
            assert.deepEqual(Object.keys(hosts[1].connections), [hosts[0].url]);

            // peers should still be there
            assert.deepEqual(hosts[0].addresses, {peer1: hosts[1].url});
            assert.deepEqual(hosts[1].addresses, {peer0: hosts[0].url});
          })
    });

    it('should cancel auto-reconnect when the reconnect timeout is exceeded', function () {
      var delay = 400; // larger than timeout!
      var timeout = 200;
      hosts[0].config({ reconnectDelay: delay, reconnectTimeout: timeout });
      hosts[1].config({ reconnectDelay: delay, reconnectTimeout: timeout });

      // join the hosts
      return hosts[0].join(urls[1])
          // find peer1 located on host1 via host0
          .then(function () {
            return hosts[0].find('peer1')
          })
          .then(function () {
            return hosts[1].find('peer0')
          })
          .then(function () {
            assert.deepEqual(hosts[0].addresses, {peer1: hosts[1].url});
            assert.deepEqual(hosts[1].addresses, {peer0: hosts[0].url});

            // hard close the connection
            hosts[1].connections[hosts[0].url].close();

            // wait for a little while so the socket is closed on both sides
            return new Promise(function (resolve) {
              setTimeout(resolve, timeout / 2);
            });
          })
          .then(function () {
            // connections should be gone
            assert.deepEqual(Object.keys(hosts[0].connections), []);
            assert.deepEqual(Object.keys(hosts[1].connections), []);

            // peers should still be there
            assert.deepEqual(hosts[0].addresses, {peer1: hosts[1].url});
            assert.deepEqual(hosts[1].addresses, {peer0: hosts[0].url});

            return new Promise(function (resolve) {
              setTimeout(resolve, delay); // (this delay adds up to the earlier timeout/2)
            });
          })
          .then(function () {
            // no more timeouts sould be running now
            assert.deepEqual(Object.keys(hosts[0].timers), []);
            assert.deepEqual(Object.keys(hosts[1].timers), []);

            // now the hosts should still be disconnected
            assert.deepEqual(Object.keys(hosts[0].connections), []);
            assert.deepEqual(Object.keys(hosts[1].connections), []);

            // peers in cache should be cleaned up now
            assert.deepEqual(hosts[0].addresses, {});
            assert.deepEqual(hosts[1].addresses, {});
          })
    });

    // TODO: test with leaving a larger network

    // TODO: test with socket errors


    it('should find a peer located on the host itself', function () {
      return hosts[0].find('peer0')
          .then(function (url) {
            assert.equal(url, hosts[0].url);
            assert.deepEqual(hosts[0].addresses, {});
          });
    });

    it('should find a peer located on the host itself when host has no url', function () {
      var host = new Host();
      var peer0 = host.create('peer0');
      return host.find('peer0')
          .then(function (url) {
            assert.equal(url, null);
            assert.deepEqual(host.addresses, {});
          });
    });

    it('should find a peer located on an other host', function () {
      // join the hosts
      return hosts[0].join(urls[1])

          // find a peer located on host1 via host0
          .then(function () {
            return hosts[0].find('peer1').then(function (url) {
              assert.equal(url, hosts[1].url);
              assert.deepEqual(hosts[0].addresses, {peer1: hosts[1].url});
            });
          })
    });

    it('should throw an error when a peer is not found', function () {
      // join the hosts
      return hosts[0].find('non-existing-peer')
          .then(function (url) {
            assert.ok(false, 'should not resolve');
          })
          .catch(function (err) {
            assert.equal(err.toString(), 'Error: Peer not found (id: non-existing-peer)');
          })
    });

    it('should send a message to a peer located on another host', function (done) {
      // join the hosts
      hosts[0].join(urls[1])
          // send a message from one peer to another
          .then(function () {
            return new Promise(function (resolve, reject) {
              peers[1].on('message', function (from, message) {
                try {
                  assert.equal(from, 'peer0');
                  assert.equal(message, 'hello peer1');
                } catch (err) {
                  done(err)
                }

                done()
              });

              peers[0].send('peer1', 'hello peer1');
            });
          })
    });

    it('should send a message to a peer on other host and receive a reply', function (done) {
      // join the hosts
      hosts[0].join(urls[1])
          // send a message from one peer to another
          .then(function () {
            return new Promise(function (resolve, reject) {
              peers[1].on('message', function (from, message) {
                try {
                  assert.equal(from, 'peer0');
                  assert.equal(message, 'hello peer1');
                } catch (err) {
                  done(err)
                }

                peers[1].send(from, 'hi there');
              });

              peers[0].on('message', function (from, message) {
                try {
                  assert.equal(from, 'peer1');
                  assert.equal(message, 'hi there');
                } catch (err) {
                  done(err)
                }

                done()
              });

              peers[0].send('peer1', 'hello peer1');
            });
          })
    });

    it('should throw a meaningful error when sending a message to a non-existing remote peer', function () {
      // join the hosts
      return hosts[0].join(urls[1])
          .then(function () {
            // send a message to a non-existing peer
            return peers[0].send('nopeer', 'hello nopeer')
          })
          .catch(function (err) {
            assert.equal(err.toString(), 'Error: Peer not found (id: nopeer)');
            assert.deepEqual(hosts[0].addresses, {});
          })
    });

    it('should throw a meaningful error when sending a message to a deleted remote peer', function () {
      // join the hosts
      return hosts[0].join(urls[1])
          .then(function () {
            // find a peer located on host 1 so it will be cached on host 0
            return hosts[0].find('peer1');
          })
          .then(function () {
            assert.deepEqual(hosts[0].addresses, {peer1: hosts[1].url});

            // delete the peer
            hosts[1].remove('peer1');

            // send a message to the deleted peer

            return peers[0].send('peer1', 'hello peer1')
          })
          .catch(function (err) {
            assert.equal(err.toString(), 'Error: Peer not found (id: peer1)');

            // the deleted peer should be removed from cache
            assert.deepEqual(hosts[0].addresses, {});
          })
    });

    it('should throw a meaningful error when sending a message to an unreachable remote peer', function () {
      // join the hosts
      return hosts[0].join(urls[1])
          .then(function () {
            // find a peer located on host 1 so it will be cached on host 0
            return hosts[0].find('peer1');
          })
          .then(function () {
            assert.deepEqual(hosts[0].addresses, {peer1: hosts[1].url});

            // close the connection
            hosts[1].connections[hosts[0].url].close();

            return new Promise(function (resolve) {
              setTimeout(resolve, 100)
            })
          })
          .then(function () {
            // send a message to the peer
            return peers[0].send('peer1', 'hello peer1')
          })
          .catch(function (err) {
            assert.equal(err.toString().indexOf('Error: Peer unreachable (id: peer1, url:'), 0);

            // the deleted peer should be still be in cache
            assert.deepEqual(hosts[0].addresses, {peer1: hosts[1].url});
          })
    });
  });


  describe('pubsub', function () {

    it('should subscribe to a channel', function () {
      var host = new Host();
      var cb = function () {};
      host.subscribe('test', cb);

      assert.deepEqual(host.channels, {test: [cb]});
    });

    it('should unsubscribe from a channel', function () {
      var host = new Host();
      var cb = function () {};
      host.subscribe('test', cb);

      assert.deepEqual(host.channels, {test: [cb]});

      host.unsubscribe('test', cb);

      assert.deepEqual(host.channels, {});
    });

    it('should publish a channel containing a string message', function (done) {
      var host = new Host();
      host.subscribe('test', function (message) {
        assert.equal(message, 'foo bar');
        done();
      });

      host.publish('test', 'foo bar');
    });

    it('should publish a channel containing an object as message', function (done) {
      var host = new Host();
      host.subscribe('test', function (message) {
        assert.deepEqual(message, {foo:'bar'});
        done();
      });

      host.publish('test', {foo:'bar'});
    });

    it('should publish a channel to multiple subscribers', function (done) {
      var host = new Host();
      var logs = [];

      function logit(message) {
        logs.push(message);

        if (logs.length == 2) {
          logs.sort();
          assert.deepEqual(logs, ['A:hello', 'B:hello']);
          done();
        }
      }

      host.subscribe('test', function (message) {
        assert.equal(message, 'hello');
        logit('A:' + message);
      });
      host.subscribe('test', function (message) {
        assert.equal(message, 'hello');
        logit('B:' + message);
      });

      host.publish('test', 'hello');
    });

  });

  it('should publish a channel and deliver to a subscriber on an other host', function (done) {
    var host1 = new Host();
    var host2 = new Host();
    var ADDRESS = '127.0.0.1';

    host1.subscribe('test', function (message) {
      assert.equal(message, 'greeting from host2');

      host1.close();
      host2.close();

      done();
    });

    Promise.all([freeport(), freeport()])
        .then(function (ports) {
          return Promise.all([host1.listen(ADDRESS, ports[0]), host2.listen(ADDRESS, ports[1])]);
        })
        .then(function () {
          return host1.join(host2.url);
        })
        .then(function () {
          host2.publish('test', 'greeting from host2');
        });
  });

});