if (typeof window !== 'undefined') {
  // browser
  if (window.WebSocket) {
    module.exports = window.WebSocket;
  }
  else {
    throw new Error('Your browser doesn\'t support WebSocket');
  }
} else {
  // node.js
  module.exports = require('ws');
}
