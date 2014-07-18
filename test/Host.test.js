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

  it('should create a peer', function () {
    var PEER1 = 'peer1';
    var host = new Host();

    return host.create(PEER1).then(function (peer1) {
      assert(peer1 instanceof Peer);
      assert.equal(peer1.id, PEER1);
      assert.deepEqual(Object.keys(host.peers), [PEER1]);
    });
  });

  it('should throw an error when creating a peer one id twice', function () {
    var PEER1 = 'peer1';
    var host = new Host();

    return host.create(PEER1)
        .then(function (peer1) {
          return host.create(PEER1);
        })
        .then(function () {
          assert.ok(false, 'should not be created twice');
        })
        .catch(function (err) {
          assert.equal(err.toString(), 'Error: Id already exists (id: peer1)');
        });
  });

  it('should remove a peer by instance', function () {
    var PEER1 = 'peer1';
    var host = new Host();

    return host.create(PEER1)
        .then(function (peer1) {
          assert.deepEqual(Object.keys(host.peers), [PEER1]);

          return host.remove(peer1)
        })
        .then(function (result) {
          assert.strictEqual(result, null);
          assert.deepEqual(Object.keys(host.peers), []);
        })
        .catch(function (err) {
          console.log(err.toString());
          assert.ok(false, 'should not reject');
        });

  });

  it('should remove a peer by id', function () {
    var PEER1 = 'peer1';
    var host = new Host();

    return host.create(PEER1)
        .then(function (peer1) {
          assert.deepEqual(Object.keys(host.peers), [PEER1]);

          return host.remove(PEER1)
        })
        .then(function (result) {
          assert.strictEqual(result, null);
          assert.deepEqual(Object.keys(host.peers), []);
        })
        .catch(function (err) {
          console.log(err.toString());
          assert.ok(false, 'should not reject');
        });
  });

  it('should ignore undefined peer in function remove', function () {
    var PEER1 = 'peer1';
    var host = new Host();

    return host.create(PEER1).then(function (peer1) {
          assert.deepEqual(Object.keys(host.peers), [PEER1]);

          return host.remove();
        })
        .then(function (result) {
          assert.strictEqual(result, null);
          assert.deepEqual(Object.keys(host.peers), [PEER1]);
        })
        .catch(function (err) {
          console.log(err.toString());
          assert.ok(false, 'should not reject');
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
            try {
              assert.equal(sender, PEER2);
              assert.equal(message, MESSAGE);
            }
            catch (err) {
              done(err);
            }
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
                try {
                  assert.strictEqual(confirm, null);
                }
                catch (err) {
                  done(err);
                }
                done();
              });
        });
  });

  it('should receive an error when sending a message failed', function () {
    var PEER1 = 'peer1';
    var PEER2 = 'peer2'; // a non-existing peer
    var MESSAGE = 'Hello world!';
    var host = new Host();

    return host.create(PEER1)
        .then(function (peer1) {
          return peer1.send(PEER2, MESSAGE)
        })
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
            return Promise.all(hosts.map(function (host, i) {return host.create('peer' + i)}));
          })

          .then(function (results) {
            peers = results;

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
            return hosts[0].find('peer1').then(function (url) {
              assert.equal(url, hosts[1].url);
              assert.deepEqual(hosts[0].addresses, {peer1: hosts[1].url});
            });
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
      // TODO
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
      return host.create('peer0')
          .then(function () {
            return host.find('peer0')
          })
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
              peers[1].on('message', function (sender, message) {
                try {
                  assert.equal(sender, 'peer0');
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

    it('should send a message to an peer on other host and receive a message', function (done) {
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

              peers[0].on('message', function (sender, message) {
                try {
                  assert.equal(sender, 'peer1');
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

  });

});