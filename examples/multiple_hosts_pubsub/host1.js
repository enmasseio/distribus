var distribus = require('../../index');

var PORT1 = 3000;

var host1 = new distribus.Host();

host1.listen('localhost', PORT1)
    .then(function () {
      host1.subscribe('news', function (message) {
        console.log('received news:', message);
      });

      console.log('waiting for news...');
    });