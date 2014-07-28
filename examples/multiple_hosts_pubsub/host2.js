var distribus = require('../../index');

var PORT2 = 3001;
var HOST1_URL = 'ws://localhost:3000';

var host2 = new distribus.Host();

host2.listen('localhost', PORT2)

    .then(function () {
      return host2.join(HOST1_URL);
    })

    .then(function () {
      console.log('connected to host1');

      var news = 'The whether forecast for today is sunny and warm.';
      console.log('publishing news: ' + news);
      host2.publish('news', news);
    })

    .catch(function (err) {
      console.log('host1 is not running, please start host1.js first');
      host2.close();
    });
