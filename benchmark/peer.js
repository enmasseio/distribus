/**
 * The overhead of sending a message to a peer via the peers send message
 *
 * - First test executes an immediate emit on a Peer
 * - Second test sends a message from one Peer to an other, involving
 *   finding the Peer and invoking it's emit function
 *
 * Conclusion: Promises introduce serious overhead :(
 *
 * Usage:
 *
 *   node benchmark/peer.js --messages 10000
 */
var distribus = require('../index'),
    Peer = require('../lib/Peer'),
    Promise = distribus.Promise,
    argv = require('optimist').argv;

var messageCount  = parseInt(argv.messages) || 0;

console.log('messages:', messageCount);

function emitIt() {
  var receivedCount = 0;

  var peer = new Peer('peer');
  peer.on('message', function (sender, message) {
    receivedCount++;
  });

  var peerTimer = 'emit ' + messageCount + ' messages to a peer';
  console.time(peerTimer);

  for (var i = 0; i < messageCount; i++) {
    peer.emit('message', 'sender', 'hello world')
  }

  if (receivedCount != messageCount) throw new Error('receivedCount is ' + receivedCount);

  console.timeEnd(peerTimer);
}

function sendIt() {
  var receivedCount = 0;

  var peers = {};

  function send(sender, recipient, message) {
    // see if the peer lives on the same host
    var peer = peers[recipient];

    if (peer) {
      peer.emit('message', sender, message);
      return Promise.resolve();
    }
    else {
      //throw new Error();
    }
  }

  var peer0 = new Peer('peer0', send);
  peers[peer0.id] = peer0;

  var peer1 = new Peer('peer1', send);
  peer1.on('message', function (sender, message) {
    receivedCount++;
  });
  peers[peer1.id] = peer1;


  var peerTimer = 'send ' + messageCount + ' messages to a peer';
  console.time(peerTimer);

  for (var i = 0; i < messageCount; i++) {
    peer0.send('peer1', 'hello world')
  }

  if (receivedCount != messageCount) throw new Error('receivedCount is ' + receivedCount);

  console.timeEnd(peerTimer);
}


emitIt();
sendIt();
