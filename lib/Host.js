var Promise = require('native-promise-only'),
    Peer = require('./Peer');

/**
 * Host
 */
function Host() {
  var peers = {};
  this.peers = peers;

  /**
   * Send a message to a peer
   * @param {String} sender     Id of the sending peer
   * @param {String} recipient  Id of the receiving peer
   * @param {*} message         JSON message
   * @returns {Promise.<null, Error>} confirmation
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
 * @param {String} id   The id for the new peer
 * @return {Promise.<Peer, Error>} peer
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
 * @param {Peer | String} peer  A peer or the id of a peer
 * @return {Promise.<null, Error>} success
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

module.exports = Host;
