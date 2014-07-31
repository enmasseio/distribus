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
 *   node benchmark/peer_via_host.js --messages 10000
 */
var distribus = require('../index'),
    Host = require('../lib/Host'),
    Peer = require('../lib/Peer'),
    Promise = distribus.Promise,
    argv = require('optimist').argv;

var messageCount  = parseInt(argv.messages) || 0;

console.log('messages:', messageCount);

function viaPeer() {
  var receivedCount = 0;

  var host = new Host();
  var peer0 = host.create('peer0');
  var peer1 = host.create('peer1');
  peer1.on('message', function (sender, message) {
    receivedCount++;
  });

  var peerTimer = 'send ' + messageCount + ' messages to a peer';
  console.time(peerTimer);

  for (var i = 0; i < messageCount; i++) {
    peer0.send('peer1', 'hello world')
  }

  if (receivedCount != messageCount) throw new Error('receivedCount is ' + receivedCount);

  console.timeEnd(peerTimer);
}

function sendImmediate() {
  var receivedCount = 0;

  var host = new Host();
  var peer0 = host.create('peer0');
  var peer1 = host.create('peer1');
  peer1.on('message', function (sender, message) {
    receivedCount++;
  });

  var peerTimer = 'send ' + messageCount + ' messages to a peer';
  console.time(peerTimer);

  for (var i = 0; i < messageCount; i++) {
    host.send('peer0', 'peer1', 'hello world')
  }

  if (receivedCount != messageCount) throw new Error('receivedCount is ' + receivedCount);

  console.timeEnd(peerTimer);
}

viaPeer();
sendImmediate();
