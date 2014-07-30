//var Emitter = require('emitter-component');


/**
 * Peer
 * A peer can send and receive messages via a connected message bus
 * @param {string} id
 * @param {function(string, string, *)} send   A function to send a message to an other peer
 */
function Peer(id, send) {
  this.id = id;
  this._send = send;

  this.listeners = {};
}

/**
 * Send a message to another peer
 * @param {string} to    Id of the recipient
 * @param {*} message    Message to be send, can be JSON
 * @returns {Promise.<null, Error>} Resolves when sent
 */
Peer.prototype.send = function (to, message) {
  return this._send(this.id, to, message);
};

// Extend the Peer with event emitter functionality
//Emitter(Peer.prototype);

// TODO: complete this custom event emitter, it's about 5 times as fast as Emitter because its not slicing arguments

/**
 * Register an event listener
 * @param {string} event        Available events: 'message'
 * @param {Function} callback   Callback function, called as callback(from, message)
 */
Peer.prototype.on = function (event, callback) {
  if (!(event in this.listeners)) this.listeners[event] = [];
  this.listeners[event].push(callback);
};

// TODO: implement off

/**
 * Emit an event
 * @param {string} event    For example 'message'
 * @param {string} from     Id of the sender, for example 'peer1'
 * @param {*} message       A message, can be any type. Must be serializable JSON.
 */
Peer.prototype.emit = function (event, from, message) {
  var listeners = this.listeners[event];
  if (listeners) {
    for (var i = 0, ii = listeners.length; i < ii; i++) {
      var listener = listeners[i];
      listener(from, message);
    }
  }
};

module.exports = Peer;
