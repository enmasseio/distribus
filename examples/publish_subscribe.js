var distribus = require('../index');

var host = new distribus.Host();

host.subscribe('news', function (message) {
  console.log('received message:', message);
});

host.publish('news', 'My first message!');

// all subscribers of the channel (on any of the connected hosts) will receive
// the message
