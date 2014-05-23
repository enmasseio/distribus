var Promise = require('native-promise-only'),
    WebSocket = require('./WebSocket'),
    WebSocketServer = WebSocket.Server,
    requestify = require('./requestify'),
    Peer = require('./Peer');

/**
 * Host
 */
function Host() {
  var peers = {};
  this.peers = peers;

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
    return new Promise(function (resolve, reject) {
      var peer = peers[recipient];
      if (!peer) {
        reject(new Error('Peer not found (id: ' + recipient + ')'))
      }
      else {
        resolve(null);
        peer.emit('message', sender, message);
      }
    });
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
  var me = this,
      peers = this.peers;

  return new Promise(function (resolve, reject) {
    if (peer instanceof Peer) { // a peer instance
      delete peers[peer.id];
    }
    else if (peer) { // a string with the peers id
      delete peers[peer];
    }

    resolve(me);
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

      me.server.on('connection', function(conn) {
        conn = requestify(conn);

        // TODO: handle connection errors
        conn.onclose = function () {
          // TODO: what to do with closed connections? remember the host and try to reconnect?
          me._removeConnection(conn);
        };

        conn.onrequest = onRequestHandler(me, conn);
      });

      resolve(me);
    });
  });
};

/**
 * Create an onRequest handler
 * @param {Host} host
 * @param {WebSocket} conn
 * @returns {Function} an onrequest handler
 */
function onRequestHandler (host, conn) {
  return function (request) {
    return host.onRequest(conn, request);
  }
}

/**
 * Handle a request
 * @param {WebSocket} conn
 * @param {Object} request
 * @returns {Promise}
 */
Host.prototype.onRequest = function (conn, request) {
  var me = this;

  return new Promise(function (resolve, reject) {
    var url;

    switch (request.method) {
      case 'greeting':
        // TODO: broadcast a greeting from a host which just joined the network
        url = request.params && request.params.url;
        if (url) {
          me.connections[url] = conn;
        }
        resolve('welcome');
        break;

      case 'goodbye':
        me._removeConnection(conn);
        // TODO: forget this host
        resolve('goodbye');
        break;

      case 'find':
      // TODO: implement find

      case 'ping':
        resolve({
          result: request.params,
          error: null
        });
        break;

      default:
        reject('Unknown method "' + request.method + '"');
    }
  });
};

/**
 * Remove a connection by instance or by url
 * @param {WebSocket} conn
 * @private
 */
Host.prototype._removeConnection = function (conn) {
  // search by instance
  for (var url in this.connections) {
    if (this.connections.hasOwnProperty(url) && this.connections[url] === conn) {
      // TODO: remove all peers located on this host from cache
      delete this.connections[url];
      break;
    }
  }
};

/**
 * Join an other Host.
 * @param {string} url   For example 'ws://localhost:300'
 * @return {Promise.<Host, Error>} Returns itself when joined
 */
Host.prototype.join = function (url) {
  var me = this;
  return new Promise(function (resolve, reject) {
    var conn = me.connections[url];

    if (conn) {
      // we are already connected to given url
      resolve(me);
    }
    else {
      // open a websocket
      conn = new WebSocket(url);
      me.connections[url] = conn;
      requestify(conn);

      conn.onrequest = onRequestHandler(me, conn);

      conn.onopen = function () {
        var request = {
          method: 'greeting',
          params: {
            url: me.url
          }
        };

        conn.request(request)
            .then(function () {
              resolve(me);
            })
            .catch(function (err) {
              reject(err);
            });
        // TODO: handle connection error
      }
    }
  });
};

/**
 * Stop listening on currently a socket
 */
Host.prototype.close = function () {
  // TODO: create a flag while closing? and opening?
  var me = this;
  return new Promise(function (resolve, reject) {
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

      // close all connections
      Promise.all(Object.keys(me.connections).map(close))

          // close the server socket
          .then(function () {
            me.server.close();
            me.server = null;
            me.address = null;
            me.port = null;
            me.url = null;

            resolve(me);
          });
    }
    else {
      // no socket open. immediately resolve
      resolve(me);
    }
  });
};

module.exports = Host;
