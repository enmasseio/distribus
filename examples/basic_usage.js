var distribus = require('../index');

var host = new distribus.Host();
var peer1 = host.create('peer1');
var peer2 = host.create('peer2');

peer1.on('message', function (sender, message) {
  console.log('peer1 received a message from ' + sender + ': ' + message);

  peer1.send(sender, 'Thanks for your message');
});

peer2.on('message', function (sender, message) {
  console.log('peer2 received a message from ' + sender + ': ' + message);
});

peer2.send('peer1', 'Hi peer1!');
