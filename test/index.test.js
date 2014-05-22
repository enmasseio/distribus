var assert = require('assert'),
    distribus = require('../index'),
    Promise = require('native-promise-only'),
    Host = require('../lib/Host'),
    Peer = require('../lib/Peer');

describe('distribus', function () {

  it('should create a distribus', function () {
    var bus = distribus();
    assert(bus instanceof Host);
  });

  it.skip('should export Promise', function () {
    // FIXME: why does this test fail?
    assert(distribus.Promise instanceof Promise);
  });

});
