var distribus = require('../index'),
    Promise = distribus.Promise;

var host1 = new distribus.Host();
var host2 = new distribus.Host();

// create two hosts
Promise.all([
      host1.listen('127.0.0.1', 3000),
      host2.listen('127.0.0.1', 3001)
    ])

    // join the hosts
    .then(function () {
      return host1.join(host2.url);
    })

    // create two peers, one on host1 and one on host2
    .then(function () {
      return Promise.all([
        host1.create('peer1'),
        host2.create('peer2')
      ])
    })

    .then(function (peers) {
      var peer1 = peers[0];
      var peer2 = peers[1];

      // listen for messages
      peer1.on('message', function (from, message) {
        console.log(this.id + ' received a message from ' + from + ': ' + message);

        // send a message back
        peer1.send(from, 'Thanks for your message');
      });

      // listen for messages
      peer2.on('message', function (from, message) {
        console.log(this.id + ' received a message from ' + from + ': ' + message);

        // remove the peers
        host1.remove(peer1);
        host2.remove(peer2);
        peer1 = null;
        peer2 = null;

        // close the hosts
        host1.close();
        host2.close();
        host1 = null;
        host2 = null;
      });

      // send a message
      peer2.send('peer1', 'Hi peer1!');
    });
