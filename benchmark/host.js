/**
 * Usage:
 *
 *   node benchmark/host.js --id 1 --address 127.0.0.1 --port 3000 --peers 100 --messages 10000
 *   node benchmark/host.js --id 1 --address 127.0.0.1 --port 3000 --peers 10000 --messages 10000
 *
 *   node benchmark/host.js --id 1 --address 127.0.0.1 --port 3000 --peers 10 --messages 0
 *   node benchmark/host.js --id 2 --address 127.0.0.1 --port 3001 --join ws://127.0.0.1:3000 --joinId 1 --peers 10 --messages 10000
 */
var distribus = require('../index'),
    Promise = distribus.Promise,
    argv = require('optimist').argv;

var host = new distribus.Host();

var hostId        = parseInt(argv.id) || 0;
var address       = argv.address || '127.0.0.1';
var port          = parseInt(argv.port) || 3000;
var join          = argv.join || null;
var joinHostId    = parseInt(argv.joinId) || null;
var hostCount     = parseInt(argv.hosts) || 0;
var peerCount     = parseInt(argv.peers) || 0;
var messageCount  = parseInt(argv.messages) || 0;

console.log('host id:', hostId);
console.log('hosts:', hostCount);
console.log('peers:', peerCount);
console.log('messages:', messageCount);

var receivedCount = 0;

// start host
host.listen(address, port)
    .then(function () {
      console.log('host listening at', host.url);
    })

    .then(function () {
      if (join) {
        return host.join(join)
            .then(function () {
              console.log('joined host', join)
            });
      }
    })

    // create peers
    .then(function () {
      var peersTimer = 'created '+ peerCount + ' peers';
      console.time(peersTimer);

      var peers = [];

      for (var i = 0; i < peerCount; i++) {
        var peerId = 'peer' + hostId + '.' + i;

        var peer = host.create(peerId);
        peer.on('message', function (sender, message) {
          receivedCount++;
        });
        peers.push(peer);
      }

        console.timeEnd(peersTimer);

        logMemory();
        return peers;
    })

    // send messages
    .then(function (peers) {
      return sendMessages2(peers);
    })

    // stop the host
    .then(function () {
      console.log('done');
      //host.close();
    })
    .catch(function (err) {
      console.log('Error', err)
    });

function logMemory() {
  var util = require('util');
  console.log('memory usage:', Math.round(process.memoryUsage().rss / 1024 / 1024), 'MB');
}

function sendMessages1(peers) {
  return new Promise(function (resolve, reject) {
    var messagesLeft = messageCount;
    var messagesTimer = 'sent '+ messageCount + ' messages';
    var start = +new Date();
    console.time(messagesTimer);

    var sender = peers[1];
    var recipient = 'peer' + (joinHostId || hostId) + '.0';
    console.log('sending ' + messageCount + ' messages from ' + sender.id + ' to ' + recipient);

    function send() {
      if (messagesLeft > 0) {
        messagesLeft--;
        sender.send(recipient, 'hello world')
            .then(send);
      }
      else {
        console.timeEnd(messagesTimer);
        var end = +new Date();
        console.log('throughput:', Math.round(messageCount/ (end - start) * 1000) + ' messages/sec')

        logMemory();

        resolve();
      }
    }

    send();
  });
}

function sendMessages2(peers) {
  return new Promise(function (resolve, reject) {
    var messagesLeft = messageCount;
    var messagesTimer = 'sent '+ messageCount + ' messages';
    var start = +new Date();
    console.time(messagesTimer);

    var sender = peers[1];
    var recipient = 'peer' + (joinHostId || hostId) + '.0';
    console.log('sending ' + messageCount + ' messages from ' + sender.id + ' to ' + recipient);

    function sendComplete () {
      messagesLeft--;
      if (messagesLeft <= 0) {
        console.timeEnd(messagesTimer);
        var end = +new Date();
        console.log('throughput:', Math.round(messageCount/ (end - start) * 1000) + ' messages/sec');

        logMemory();

        resolve();
      }
    }

    for (var i = 0; i < messageCount; i++) {
      sender.send(recipient, 'hello world')
          .then(sendComplete);
    }
  });
}
