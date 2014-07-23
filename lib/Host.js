var Promise = require('./Promise'),
    WebSocket = require('./WebSocket'),
    WebSocketServer = WebSocket.Server,
    requestify = require('./requestify'),
    Peer = require('./Peer');

/**
 * Host
 */
function Host() {
  var me = this;
  var peers = {}; // local peers
  this.peers = peers;
  this.topics = {};     // keys are the topics, values are arrays with callbacks

  this.addresses = {};  // cached addresses of peers located on other hosts

  this.server = null;
  this.address = null;
  this.port = null;

  this.connections = {}; // List with open connections, key is the url and value is the connection

  /**
   * Send a message to a peer
   * @param {string} sender     Id of the sending peer
   * @param {string} recipient  Id of the receiving peer
   * @param {*} message         JSON message
   * @returns {Promise.<null, Error>} Resolves when sent
   * @private
   */
  this._send = function (sender, recipient, message) {
    // see if the peer lives on the same host
    var peer = peers[recipient];

    if (peer) {
      peer.emit('message', sender, message);
      return Promise.resolve(null);
    }
    else {
      // TODO: if a peer no longer exists, it should be removed from the queue

      // find the host where the recipient is located
      return me.find(recipient)
          .then(function (url) {
            var conn = me.connections[url];
            if (conn) {
              var request = {
                method: 'send',
                params: {
                  from: sender,
                  to: recipient,
                  message: message
                }
              };
              // TODO: there is a maximum callstack issue when queuing a lot of notifications
              return conn.request(request); // the send request returns null
              //return conn.notify(request); // the send request returns null
            }
            else {
              // TODO: if there is no connection to this host for whatever reason, create it
              throw new Error('No connection open to url ' + url);
            }
          });
    }
  };
}

/**
 * Create a new peer
 * @param {string} id   The id for the new peer
 * @return {Promise.<Peer, Error>} Returns the created peer
 */
Host.prototype.create = function (id) {
  var peers = this.peers,
      _send = this._send;

  return new Promise(function (resolve, reject) {
    if (id in peers) {
      reject(new Error('Id already exists (id: ' + id +')'))
    }
    else {
      var peer = new Peer(id, _send);
      peers[id] = peer;

      resolve(peer);
    }
  });
};

/**
 * Remove a peer from the host
 * @param {Peer | string} peer  A peer or the id of a peer
 * @return {Promise.<null, Error>} Returns null on success
 */
Host.prototype.remove = function (peer) {
  var peers = this.peers;

  return new Promise(function (resolve, reject) {
    if (peer instanceof Peer) { // a peer instance
      delete peers[peer.id];
    }
    else if (peer) { // a string with the peers id
      delete peers[peer];
    }

    resolve(null);
  });
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
    function requestFind(conn) {
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
    var requests = [];
    for (url in me.connections) {
      if (me.connections.hasOwnProperty(url)) {
        requests.push(requestFind(me.connections[url]));
      }
    }

    // if all requests are finished and the peer is not found, reject with an error
    Promise.all(requests)
        .then(function () {
          if (!found || requests.length == 0) {
            reject(new Error('Peer not found (id: ' + id + ')'));
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
        var forgetPeers = false;
        me._removeConnection(conn, forgetPeers);
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
  var url;

  switch (request.method) {
    case 'greeting':
      url = request.params && request.params.url;
      if (url && !(url in this.connections)) {
        this.connections[url] = conn;
        return this._broadcastJoin(url)
            .then(function () {
              return Promise.resolve('welcome')
            });
      }
      else {
        return Promise.resolve('welcome');
      }

    case 'join':
      url = request.params && request.params.url;
      return this.join(url)
          .then(function (host) {
            return Promise.resolve();
          });

    case 'goodbye':
      var forgetPeers = true;
      this._removeConnection(conn, forgetPeers);
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
        return Promise.reject(new Error('Peer not found (id' + to + ')'));
      }

    case 'publish':
      var topic   = request.params && request.params.topic;
      var message = request.params && request.params.message;
      this._publish(topic, message);
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
 * Remove a connection from the list with connections, and all cached peers
 * on that host.
 * NOTE: The connection will not be closed, that must be done separately!
 * @param {WebSocket} conn
 * @param {boolean} forgetPeers
 * @private
 */
Host.prototype._removeConnection = function (conn, forgetPeers) {
  var url = this._findUrl(conn);

  // remove the connection from the list
  var connection = this.connections[url];
  if (connection) {
    delete this.connections[url];
  }

  if (forgetPeers) {
    // remove all cached peers
    for (var id in this.addresses) {
      if (this.addresses.hasOwnProperty(id) && this.addresses[id] === url) {
        delete this.addresses[id];
      }
    }
  }
};

/**
 * Join an other Host.
 * @param {string} url              For example 'ws://localhost:3000'
 * @return {Promise.<Host, Error>}  Returns itself when joined
 */
Host.prototype.join = function (url) {
  var me = this;

  if (url && !(url in me.connections)) {
    return me._connect(url)
        .then(function (conn) {
          // send a greeting with the hosts url
          return conn.request({method: 'greeting', params: { url: me.url } })
        })
        .then(function () {
          // broadcast the join request to all known hosts
          return me._broadcastJoin(url)
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
      var forgetPeers = false;
      me._removeConnection(conn, forgetPeers);
    };

    conn.onopen = function () {
      resolve(conn);
    };

    conn.onerror = function (err) {
      reject(err);
    };
  });
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
  // TODO: create a flag while closing? and opening?
  var me = this;
  if (me.server) {
    // close a connection
    function close(url) {
      var conn = me.connections[url];

      // send a goodbye message
      return conn.request({method: 'goodbye'})
          .catch(function (err) {
            // ignore failing to send goodbye
          })

          // then close the connection
          .then(function () {
            conn.close();
            delete me.connections[url]
          });
    }

    // close the host itself
    function finish() {
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

    // array with all connections
    var connections = Object.keys(me.connections);

    // close all connections
    return Promise.all(connections.map(close)).then(finish);
  }
  else {
    // no socket open. immediately resolve
    Promise.resolve(me);
  }
};

/**
 * Publish a topic. All listeners subscribed to this topic will be triggered,
 * both listeners on this host as well as connected hosts.
 * @param {string} topic The name of the topic
 * @param {*} message    A message, can be any type. Must be serializable JSON.
 */
Host.prototype.publish = function (topic, message) {
  // trigger local subscribers
  this._publish(topic, message);

  // send the message to all connected hosts
  for (var url in this.connections) {
    if (this.connections.hasOwnProperty(url)) {
      var connection = this.connections[url];
      connection.notify({
        method: 'publish',
        params: {
          topic: topic,
          message: message
        }
      });
    }
  }
  // TODO: improve efficiency by having the hosts share the topics for which
  //       they have subscribers, so we only have to send a message to a
  //       particular host when it has subscribers to the topic.
};

/**
 * Publish a topic to all subscribers on this host.
 * @param {string} topic The name of the topic
 * @param {*} message    A message, can be any type. Must be serializable JSON.
 */
Host.prototype._publish = function (topic, message) {
  // trigger local subscribers
  var callbacks = this.topics[topic];
  if (callbacks) {
    callbacks.forEach(function (callback) {
      callback(message);
    });
  }
};

/**
 * Subscribe to a topic.
 * @param {string} topic        The name of the topic
 * @param {function} callback   Called as callback(message)
 */
Host.prototype.subscribe = function (topic, callback) {
  var callbacks = this.topics[topic];
  if (!callbacks) {
    callbacks = [];
    this.topics[topic] = callbacks;
  }
  callbacks.push(callback);
};

/**
 * Unsubscribe from a topic.
 * @param {string} topic        The name of the topic
 * @param {function} callback   A callback used before to subscribe
 */
Host.prototype.unsubscribe = function (topic, callback) {
  var callbacks = this.topics[topic];
  if (callbacks) {
    var index = callbacks.indexOf(callback);
    if (index !== -1) {
      callbacks.splice(index, 1);
      if (callbacks.length === 0) {
        delete this.topics[topic];
      }
    }
  }
};


// TODO: implement a function list() whicht returns the id's of all peers in the system

module.exports = Host;
