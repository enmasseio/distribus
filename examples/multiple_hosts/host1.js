var distribus = require('../../index');

var PORT1 = 3000;
var HOST2_URL = 'ws://localhost:3001';

var host1 = new distribus.Host();
var peer1 = host1.create('peer1');

peer1.on('message', function (from, message) {
  console.log('Received a message from ' + from + ': "' + message + '"');

  if (message.indexOf('hello') === 0) {
    peer1.send(from, 'hi ' + from);
  }
});

host1.listen('localhost', PORT1)

    .then(function () {
      return host1.join(HOST2_URL);
    })

    .then(function () {
      console.log('Connected to host2');

      var message = 'hello peer2';
      console.log('Sending a message to peer2: "' + message + '"');
      peer1.send('peer2', message);
    })

    .catch(function (err) {
      console.log('host2 is not running, please start host2.js as well');
    });
