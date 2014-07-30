var distribus = require('../index');

var host = new distribus.Host();
var peer1 = host.create('peer1');
var peer2 = host.create('peer2');

peer1.on('message', function (from, message) {
  console.log('peer1 received a message from ' + from + ': ' + message);

  peer1.send(from, 'Thanks for your message');
});

peer2.on('message', function (from, message) {
  console.log('peer2 received a message from ' + from + ': ' + message);
});

peer2.send('peer1', 'Hi peer1!');
