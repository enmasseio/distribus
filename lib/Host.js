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
 * @return {Promise.<Peer, Error>} Resolves with the created peer
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
 * @return {Promise.<null, Error>} Resolves when success
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
 * Start listening on a socket.
 * @param {string} address
 * @param {number} port
 * @return {Promise.<null, Error>} Resolves when connected
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

      me.server.on('connection', function(client) {
        client = requestify(client);

        client.onrequest = function (request) {
          return new Promise(function (resolve, reject) {
            switch (request.method) {
              case 'greeting':
                // TODO: broadcast a greeting from a host which just joined the network

                break;

              case 'goodbye':
                // TODO: implement a goodbye message
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
      });

      resolve();
    });
  });
};

/**
 * Join an other Host.
 * @param {string} url   For example 'ws://localhost:300'
 * @return {Promise.<null, Error>} Resolves when joined
 */
Host.prototype.join = function (url) {
  // TODO: implement join

  // TODO: after opening a socket connection, send a greeting
};

/**
 * Stop listening on currently a socket
 */
Host.prototype.close = function () {
  var me = this;
  return new Promise(function (resolve, reject) {
    if (me.socket) {
      // TODO: first send a goodbye message to all connected hosts

      me.socket.close();
      me.socket = null;
      me.address = null;
      me.port = null;
      resolve(null);
    }
  });
};

module.exports = Host;
