var distribus = require('../../index');

var PORT2 = 3001;
var HOST1_URL = 'ws://localhost:3000';

var host2 = new distribus.Host();
var peer2 = host2.create('peer2');

peer2.on('message', function (from, message) {
  console.log('Received a message from ' + from + ': "' + message + '"');

  if (message.indexOf('hello') === 0) {
    peer2.send(from, 'hi ' + from);
  }
});

host2.listen('localhost', PORT2)

    .then(function () {
      return host2.join(HOST1_URL);
    })

    .then(function () {
      console.log('Connected to host1');

      var message = "hello peer1";
      console.log('Sending a message to peer1: "' + message + '"');
      peer2.send('peer1', message);
    })

    .catch(function (err) {
      console.log('host1 is not running, please start host1.js as well');
    });
