var Promise = require('native-promise-only'),
    Host = require('./lib/Host'),
    Peer = require('./lib/Peer');

function distribus() {
  return new Host();
}

distribus.Promise = Promise;

module.exports = distribus;
