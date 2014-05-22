var Emitter = require('emitter-component');


/**
 * Peer
 * A peer can send and receive messages via a connected message bus
 * @param {String} id
 * @param {function(string, string, *)} send   A function to send a message to an other peer
 */
function Peer(id, send) {
  this.id = id;
  this._send = send;
}

/**
 * Send a message to another peer
 * @param {String} recipient    Id of the recipient
 * @param {*} message           Message to be send, can be JSON
 * @returns {Promise.<null, Error | null>} confirmation
 */
Peer.prototype.send = function (recipient, message) {
  return this._send(this.id, recipient, message);
};

// Extend the Peer with event emitter functionality
Emitter(Peer.prototype);

module.exports = Peer;
