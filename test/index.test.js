var assert = require('assert'),
    distribus = require('../index'),
    Promise = require('bluebird'),
    Host = require('../lib/Host'),
    Peer = require('../lib/Peer');

describe('distribus', function () {

  it('should export Host', function () {
    assert.strictEqual(distribus.Host, Host);
  });

  it('should export Promise', function () {
    assert.strictEqual(distribus.Promise, Promise);
  });

});
