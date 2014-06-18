
var count = 1e5;

function test(Promise, name) {
  var msg = 'testing ' + name;
  console.time(msg);
  var finished = 0;
  var all = [];
  for (var i = 0; i < count; i++) {
    var p = new Promise(function (resolve, reject) {
      resolve();
    })
        .then(function () {
          finished++;
        });
    all.push(p);
  }

  return Promise.all(all)
      .then(function () {

        if (finished !== count) throw new Error('finished=' + finished);

        console.timeEnd(msg);

      })
}

test(require('native-promise-only'), 'native-promise-only')
    .then(function () {
      return test(require('bluebird'), 'bluebird')
    })
    .then(function () {
      return test(require('promise'), 'promise')
    })
    .then(function () {
      return test(require('workerpool').Promise, 'workerpool.Promise')
    })
    .then(function () {
      console.log('done');
    })
    .catch(function (err) {
      console.log('Error', err);
    });
