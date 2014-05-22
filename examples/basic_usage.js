var distribus = require('../index'),
    Promise = distribus.Promise;

var host = new distribus.Host();

Promise.all([
      host.create('peer1'),
      host.create('peer2')
    ])
    .then(function (peers) {
      var peer1 = peers[0];
      var peer2 = peers[1];

      peer1.on('message', function (sender, message) {
        console.log(this.id + ' received a message from ' + sender + ': ' + message);

        peer1.send(sender, 'Thanks for your message');
      });

      peer2.on('message', function (sender, message) {
        console.log(this.id + ' received a message from ' + sender + ': ' + message);

        host.remove(peer1);
        host.remove(peer2);
      });

      peer2.send('peer1', 'Hi peer1!');
    });
