var distribus = require('../../index');

var PORT2 = 3001;
var HOST1_URL = 'ws://localhost:3000';

var host2 = new distribus.Host();
var peer2;

host2.listen('localhost', PORT2)

    .then(function () {
      return host2.join(HOST1_URL);
    })

    .catch(function (err) {
      console.log('host1 is not running, please start host1.js first');
    })

    .then(function () {
      console.log('connected to host1');

      host2.publish('news', 'The whether forecast for today: sunny and warm.');
    });
