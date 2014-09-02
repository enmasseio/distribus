var WebSocket = require('ws');
var WebSocketServer = require('ws').Server;
var uuid = require('node-uuid');
var Promise = require('./Promise');
var requestify = require('./requestify');
var Peer = require('./Peer');

/**
 * Host
 * @param {Object} [options]  Available options: see Host.config
 */
function Host(options) {
  var me = this;

  // peers and cached peer addresses
  this.peers = {};      // local peers
  this.addresses = {};  // cached addresses of peers located on other hosts

  // pubsub
  this.channels = {};   // keys are the channels, values are arrays with callbacks of subscribers

  // default options
  this.options = {
    reconnectTimeout: 5 * 60 * 1000,  // give up reconnecting after 5 minutes
    reconnectDelay: 1000,             // try reconnecting after one second
    reconnectDecay: 2
  };

  // server properties
  this.server = null;
  this.address = null;
  this.port = null;
  this.connections = {}; // List with open connections, key is the url and value is the connection
  this.timers = {};      // reconnect timers

  /**
   * Send a message from one peer to another
   * @param {string} from   Id of the sending peer
   * @param {string} to     Id of the receiving peer
   * @param {*} message     JSON message
   * @returns {Promise.<null, Error>} Resolves when sent
   */
  this.send = function (from, to, message) {
    // see if the peer lives on the same host
    var peer = me.peers[to];
    if (peer) {
      peer.emit('message', from, message);
      return Promise.resolve(null);
    }

    // find the remote host where the recipient is located
    return me.find(to)
        .then(function (url) {
          var conn = me.connections[url];
          if (conn) {
            var request = {
              method: 'send',
              params: {
                from: from,
                to: to,
                message: message
              }
            };
            // TODO: there is a maximum callstack issue when queuing a lot of notifications
            return conn.request(request) // the send request returns null
            //return conn.notify(request) // the send request returns null
                .catch(function (err) {
                  // FIXME: use a protocol for errors, use error code
                  if (err.toString().indexOf('Error: Peer not found') === 0) {
                    // this peer was deleted. Remove it from cache
                    delete me.addresses[to];
                    throw _peerNotFoundError(to);
                  }
                })
          }
          else {
            throw _peerUnreachable(to, url);
          }
        });
  };

  this.config(options);
}

/**
 * Apply configuration options to the host, and/or retrieve the current
 * configuration.
 * @param {Object} [options]  Available options:
 *                            - networkId          An id for the distribus
 *                                                 network. A Host can only
 *                                                 connect to other hosts with
 *                                                 the same id. networkId cannot
 *                                                 be changed once set.
 *                            - reconnectTimeout   Timeout in milliseconds for
 *                                                 giving up reconnecting.
 *                                                 5 minutes by default
 *                            - reconnectDelay     Initial delay for trying to
 *                                                 reconnect. for consecutive
 *                                                 reconnect trials, the delay
 *                                                 decays with a factor
 *                                                 `reconnectDecay`.
 *                                                 1 second by default.
 *                            - reconnectDecay     Decay for the reconnect
 *                                                 delay. 2 by default.
 * @return {Object} Returns the current configuration
 */
Host.prototype.config = function (options) {
  // apply new options
  if (options) {
    _merge(this.options, options);

    // apply networkId
    if (options.networkId) {
      if (this.networkId !== null) {
        this.networkId = options.networkId;
      }
      else {
        throw new Error('Cannot replace networkId once set');
      }
    }
  }

  // return a copy of the options
  return _merge({}, this.options);
};

/**
 * Create a new peer.
 * Throws an error when a peer with the same id already exists on this host.
 * Does not check whether this id exists on any remote host (use Host.find(id)
 * to validate this before creating a peer, or even better, use a uuid to
 * prevent id collisions).
 * @param {string} id   The id for the new peer
 * @return {Peer} Returns the created peer
 */
Host.prototype.create = function (id) {
  if (id in this.peers) {
    throw new Error('Id already exists (id: ' + id +')');
  }

  var peer = new Peer(id, this.send);
  this.peers[id] = peer;

  return peer;
};

/**
 * Remove a peer from the host
 * @param {Peer | string} peer  A peer or the id of a peer
 */
Host.prototype.remove = function (peer) {
  if (peer instanceof Peer) { // a peer instance
    delete this.peers[peer.id];
  }
  else if (peer) { // a string with the peers id
    delete this.peers[peer];
  }
};

/**
 * Get a local peer by its id
 * @param {string} id   The id of an existing peer
 * @return {Peer | null} returns the peer, or returns null when not existing.
 */
Host.prototype.get = function (id) {
  return this.peers[id] || null;
};

/**
 * Find the host of a peer by it's id
 * @param {string} id   Id of a peer
 * @return {Promise.<string | null, Error>} The url of the peers host.
 *                                          Returns null if the found host has no url.
 *                                          Throws an error if not found.
 */
Host.prototype.find = function (id) {
  var me = this;

  // check if this is a local peer
  if (id in me.peers) {
    return Promise.resolve(me.url || null);
  }

  // check if this id is already in cache
  var url = me.addresses[id];
  if (url) {
    // yes, we already have the address
    return Promise.resolve(url);
  }

  // search on other hosts
  return new Promise(function (resolve, reject) {
    // TODO: send requests in small batches, not all at once

    // send a find request to a host
    var found = false;
    function _find(url) {
      var conn = me.connections[url];
      return conn.request({method: 'find', params: {id: id}})
          .then(function (url) {
            if (url && !found) {
              // we found the peer
              found = true;

              // put this address in cache
              // TODO: limit the number of cached addresses. When exceeding the limit, store on disk in a temporary db
              me.addresses[id] = url;

              // return the found url
              resolve(url);
            }
          });
    }

    // ask all connected hosts if they host this peer
    var results = Object.keys(me.connections).map(_find);

    // if all requests are finished and the peer is not found, reject with an error
    Promise.all(results)
        .then(function () {
          if (!found || results.length == 0) {
            reject(_peerNotFoundError(id));
          }
        });
  });
};

/**
 * Start listening on a socket.
 * @param {string} address
 * @param {number} port
 * @return {Promise.<Host, Error>} Returns itself when connected
 */
Host.prototype.listen = function (address, port) {
  var me = this;

  return new Promise(function (resolve, reject) {
    if (me.server) {
      reject(new Error('Server already listening'));
      return;
    }

    me.server = new WebSocketServer({port: port}, function () {
      me.address = address;
      me.port = port;
      me.url = 'ws://' + address + ':' + port;

      resolve(me);
    });

    me.server.on('connection', function (conn) {
      conn = requestify(conn);

      conn.onerror = function (err) {
        // TODO: what to do with errors?
      };

      conn.onclose = function () {
        // remove this connection from the connections list
        // (we do not yet forget the cached peers)
        var url = me._findUrl(conn);
        delete me.connections[url];

        me.timers[url] = setTimeout(function () {
          delete me.timers[url];

          // clear cache
          me._forgetPeers(url);
        }, me.options.reconnectTimeout);
      };

      conn.onrequest = function (request) {
        return me._onRequest(conn, request);
      };
    });

    me.server.on('error', function (err) {
      reject(err)
    });
  });
};

/**
 * Handle a request
 * @param {WebSocket} conn
 * @param {Object} request
 * @returns {Promise}
 * @private
 */
Host.prototype._onRequest = function (conn, request) {
  var me = this;
  var url;

  switch (request.method) {
    case 'greeting':
      url = request.params && request.params.url;
      var networkId = request.params.networkId || null;
      if (networkId === null || networkId === me.networkId) {
        if (url && !(url in this.connections)) {
          this.connections[url] = conn;
          return this._broadcastJoin(url)
              .then(function () {
                return Promise.resolve({networkId: me.networkId})
              });
        }
        else {
          return Promise.resolve({networkId: me.networkId});
        }
      }
      else {
        return Promise.reject(new Error('Network id mismatch (' + networkId + ' !== ' + me.networkId + ')'));
      }

    case 'join':
      url = request.params && request.params.url;
      return this.join(url)
          .then(function (host) {
            return Promise.resolve();
          });

    case 'goodbye':
      url = this._findUrl(conn);
      this._forgetPeers(url);
      this._disconnect(url);
      return Promise.resolve('goodbye');

    case 'hosts':
      // connect to all newly retrieved urls
      if (request.params && request.params.urls) {
        this.join(request.params.urls);
      }

      // return a list with the urls of all known hosts
      return Promise.resolve(Object.keys(this.connections));

    case 'find': // find a peer
      var id = request.params && request.params.id;
      return Promise.resolve(this.peers[id] ? this.url : null);

    case 'send':
      var from    = request.params && request.params.from;
      var to      = request.params && request.params.to;
      var message = request.params && request.params.message;

        // TODO: validate whether all parameters are there
      var peer = this.peers[to];
      if (peer) {
        peer.emit('message', from, message);
        return Promise.resolve(null);
      }
      else {
        return Promise.reject(_peerNotFoundError(to).toString());
      }

    case 'publish':
      var channel = request.params && request.params.channel;
      var message = request.params && request.params.message;
      this._publish(channel, message);
      return Promise.resolve({
        result: null,
        error: null
      });

    case 'ping':
      return Promise.resolve({
        result: request.params,
        error: null
      });

    default:
      return Promise.reject('Unknown method "' + request.method + '"');
  }
};

/**
 * Find an url from a connection
 * @param {WebSocket} conn
 * @return {String | null} url
 * @private
 */
Host.prototype._findUrl = function (conn) {
  // search by instance
  for (var url in this.connections) {
    if (this.connections.hasOwnProperty(url) && this.connections[url] === conn) {
      return url;
    }
  }

  return null;
};

/**
 * Remove all cached peers of given
 * @param {string} url   Url of a host for which to forget the cached peers
 * @private
 */
Host.prototype._forgetPeers = function (url) {
  // remove all cached peers
  for (var id in this.addresses) {
    if (this.addresses.hasOwnProperty(id) && this.addresses[id] === url) {
      delete this.addresses[id];
    }
  }
};

/**
 * Join an other Host.
 * A host can only join another host when having the same id, or having no id
 * defined. In the latter case, the host will orphan the id of the host it
 * connects to.
 * @param {string} url              For example 'ws://localhost:3000'
 * @return {Promise.<Host, Error>}  Returns itself when joined
 */
Host.prototype.join = function (url) {
  var me = this;

  if (url && !(url in me.connections)) {
    return me._connect(url)
        .then(function () {
          // broadcast the join request to all known hosts
          return me._broadcastJoin(url);
        })
        .then(function (urls) {
          // return the host itself as last result in the promise chain
          return me;
        });
      // TODO: handle connection error
  }
  else {
    // already known url. ignore this join
    // FIXME: it is possible that this connection is still being established
    return Promise.resolve(me);
  }
};

/**
 * Open a connection to an other host and add the host to the list of connected
 * hosts.
 * @param {String} url
 * @returns {Promise.<WebSocket, Error>} Returns the established connection
 * @private
 */
Host.prototype._connect = function(url) {
  var me = this;

  return new Promise(function (resolve, reject) {
    // open a web socket
    var conn = new WebSocket(url);
    requestify(conn);
    me.connections[url] = conn;

    conn.onrequest = function (request) {
      return me._onRequest(conn, request);
    };

    conn.onclose = function () {
      if (me.connections[url]) {
        // remove the connection from the list
        delete me.connections[url];

        // schedule reconnection
        me._reconnect(url);
      }
    };

    conn.onopen = function () {
      // send a greeting with the hosts url
      conn.request({method: 'greeting', params: { url: me.url, networkId: me.networkId } })
          .then(function (params) {
            me.networkId = params.networkId;
            resolve(conn);
          })
          .catch(function (err) {
            // greeting rejected
            delete me.connections[url];
            conn.close();
            reject(err);
          });
    };

    conn.onerror = function (err) {
      delete me.connections[url];
      reject(err);
      conn.close();
    };
  });
};

/**
 * Reconnect with a host
 * @param {String} url    Url of the host to which to reconnect
 * @private
 */
Host.prototype._reconnect = function (url) {
  var me = this;
  var start = new Date().valueOf();

  function scheduleReconnect(delay, trial) {
    me.timers[url] = setTimeout(function () {
      delete me.timers[url];

      var now = new Date().valueOf();
      if (now - start < me.options.reconnectTimeout) {
        // reconnect
        me._connect(url)
          .catch(function (err) {
              // schedule next reconnect trial
              scheduleReconnect(delay / me.options.reconnectDecay, trial + 1);
          });
      }
      else {
        // give up trying to reconnect
        me._forgetPeers(url);
      }
    }, delay);
  }

  // schedule reconnection after a delay
  scheduleReconnect(me.options.reconnectDelay, 0);
};

/**
 * Forward a join message to all known hosts
 * @param {string} url              For example 'ws://localhost:3000'
 * @return {Promise.<String[], Error>} returns the joined urls
 */
Host.prototype._broadcastJoin = function (url) {
  // TODO: implement a more efficient broadcast mechanism

  var me = this;
  var urls = Object.keys(me.connections)
      .filter(function (u) {
        return u !== url
      });

  function join (existingUrl) {
    var conn = me.connections[existingUrl];
    return conn.request({method: 'join', params: {'url': url}})
        .catch(function (err) {
          // TODO: what to do with failed requests? Right now we ignore them
        })
        .then(function () {
          // return the url where the join is broadcasted to
          return existingUrl;
        })
  }

  // send a join request to all known hosts
  return Promise.all(urls.map(join));
};

/**
 * Stop listening on currently a socket
 * @return {Promise.<Host, Error>} Returns itself
 */
Host.prototype.close = function () {
  var me = this;

  // TODO: create a flag while closing? and opening?
  if (this.server) {
    // close the host, and clean up cache
    function closeHost() {
      // close the host itself
      me.addresses = {};

      if (me.server) {
        me.server.close();
        me.server = null;
        me.address = null;
        me.port = null;
        me.url = null;
      }

      return me;
    }

    // close all connections
    var urls = Object.keys(this.connections);
    return Promise.all(urls.map(function (url) {
      return me._disconnect(url);
    })).then(closeHost);
  }
  else {
    // no socket open. resolve immediately
    Promise.resolve(this);
  }
};

/**
 * Close the connection with a host. Note: peers are not removed from cache
 * @param {string} url   Url of a connected host
 * @return {Promise.<undefined, Error>} Resolves a promise when closed
 * @private
 */
Host.prototype._disconnect = function (url) {
  var conn = this.connections[url];
  if (conn) {
    delete this.connections[url];

    if (this.timers[url]) {
      clearTimeout(this.timers[url]);
      delete this.timers[url];
    }

    // send a goodbye message
    return conn.request({method: 'goodbye'})
        .catch(function (err) {
          // ignore failing to send goodbye
        })

      // then close the connection
        .then(function () {
          conn.close();
        });
  }
  else {
    Promise.resolve();
  }
};

/**
 * Publish a message via a channel. All listeners subscribed to this channel
 * will be triggered, both listeners on this host as well as connected hosts.
 * @param {string} channel  The name of the channel
 * @param {*} message       A message, can be any type. Must be serializable JSON.
 */
Host.prototype.publish = function (channel, message) {
  // trigger local subscribers
  this._publish(channel, message);

  // send the message to all connected hosts
  for (var url in this.connections) {
    if (this.connections.hasOwnProperty(url)) {
      var connection = this.connections[url];
      connection.notify({
        method: 'publish',
        params: {
          channel: channel,
          message: message
        }
      });
    }
  }
  // TODO: improve efficiency by having the hosts share the channels for which
  //       they have subscribers, so we only have to send a message to a
  //       particular host when it has subscribers to the channel.
};

/**
 * Publish a channel to all subscribers on this host.
 * @param {string} channel  The name of the channel
 * @param {*} message       A message, can be any type. Must be serializable JSON.
 * @private
 */
Host.prototype._publish = function (channel, message) {
  // trigger local subscribers
  var callbacks = this.channels[channel];
  if (callbacks) {
    callbacks.forEach(function (callback) {
      callback(message);
    });
  }
};

/**
 * Subscribe to a channel.
 * @param {string} channel      The name of the channel
 * @param {function} callback   Called as callback(message)
 */
Host.prototype.subscribe = function (channel, callback) {
  // TODO: implement support for wildcards, like subscribing to "foo.*" or something like that
  var callbacks = this.channels[channel];
  if (!callbacks) {
    callbacks = [];
    this.channels[channel] = callbacks;
  }
  callbacks.push(callback);
};

/**
 * Unsubscribe from a channel.
 * @param {string} channel      The name of the channel
 * @param {function} callback   A callback used before to subscribe
 */
Host.prototype.unsubscribe = function (channel, callback) {
  var callbacks = this.channels[channel];
  if (callbacks) {
    var index = callbacks.indexOf(callback);
    if (index !== -1) {
      callbacks.splice(index, 1);
      if (callbacks.length === 0) {
        delete this.channels[channel];
      }
    }
  }
};

/**
 * Merge object b into object a: copy all properties of b to a
 * @param {Object} a
 * @param {Object} b
 * @return {Object} returns the merged a
 * @private
 */
function _merge (a, b) {
  for (var prop in b) {
    if (b.hasOwnProperty(prop)) {
      a[prop] = b[prop];
    }
  }
  return a;
}

/**
 * Create an Error "Peer not found"
 * @param {string} id   The id of the peer
 * @return {Error}
 * @private
 */
function _peerNotFoundError(id) {
  return new Error('Peer not found (id: ' + id + ')');
}

/**
 * Create an Error "Peer unreachable"
 * @param {string} id   The id of the peer
 * @param {string} url  Url of the peers host
 * @return {Error}
 * @private
 */
function _peerUnreachable(id, url) {
  return new Error('Peer unreachable (id: ' + id + ', url: ' + url + ')');
}

// TODO: implement a function list() which returns the id's of all peers in the system

module.exports = Host;
