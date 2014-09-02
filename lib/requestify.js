var uuid = require('node-uuid'),
    Promise = require('./Promise');

var TIMEOUT = 60000; // ms
// TODO: make timeout a configuration setting

/**
 * Wrap a socket in a request/response handling layer.
 * Requests are wrapped in an envelope with id and data, and responses
 * are packed in an envelope with this same id and response data.
 *
 * The socket is extended with functions:
 *     request(data: *) : Promise.<*, Error>
 *     onrequest(data: *) : Promise.<*, Error>
 *
 * @param {WebSocket} socket
 * @return {WebSocket} requestified socket
 */
function requestify (socket) {
  return (function () {
    var queue = {};   // queue with requests in progress

    if ('request' in socket) {
      throw new Error('Socket already has a request property');
    }

    var requestified = socket;

    /**
     * Event handler, handles incoming messages
     * @param {Object} event
     */
    socket.onmessage = function (event) {
      var data = event.data;
      if (data.charAt(0) == '{') {
        var envelope = JSON.parse(data);

        // match the request from the id in the response
        var request = queue[envelope.id];
        if (request) {
          // handle an incoming response
          clearTimeout(request.timeout);
          delete queue[envelope.id];

          // resolve the promise with response data
          if (envelope.error) {
            // TODO: implement a smarter way to serialize and deserialize errors
            request.reject(new Error(envelope.error));
          }
          else {
            request.resolve(envelope.message);
          }
        }
        else {
          if ('id' in envelope) {
            try {
              // handle an incoming request
              requestified.onrequest(envelope.message)
                  .then(function (message) {
                    var response = {
                      id: envelope.id,
                      message: message,
                      error: null
                    };
                    socket.send(JSON.stringify(response));
                  })
                  .catch(function (error) {
                    var response = {
                      id: envelope.id,
                      message: null,
                      error: error.message || error.toString()
                    };
                    socket.send(JSON.stringify(response));
                  });
            }
            catch (err) {
              var response = {
                id: envelope.id,
                message: null,
                error: err.message || err.toString()
              };
              socket.send(JSON.stringify(response));
            }
          }
          else {
            // handle incoming notification (we don't do anything with the response)
            requestified.onrequest(envelope.message);
          }
        }
      }
    };

    /**
     * Send a request
     * @param {*} message
     * @returns {Promise.<*, Error>} Returns a promise resolving with the response message
     */
    requestified.request = function (message) {
      return new Promise(function (resolve, reject) {
        // put the data in an envelope with id
        var id = uuid.v1();
        var envelope = {
          id: id,
          message: message
        };

        // add the request to the list with requests in progress
        queue[id] = {
          resolve: resolve,
          reject: reject,
          timeout: setTimeout(function () {
            delete queue[id];
            reject(new Error('Timeout'));
          }, TIMEOUT)
        };

        socket.send(JSON.stringify(envelope));
      });
    };

    /**
     * Send a notification. A notification does not receive a response.
     * @param {*} message
     * @returns {Promise.<null, Error>} Returns a promise resolving with the null
     *                                  when the notification has been sent.
     */
    requestified.notify = function (message) {
      return new Promise(function (resolve, reject) {
        // put the data in an envelope
        var envelope = {
          // we don't add an id, so we send this as notification instead of a request
          message: message
        };

        socket.send(JSON.stringify(envelope), function () {
          resolve(null);
        });
      });
    };

    /**
     * Handle an incoming request.
     * @param {*} message   Request message
     * @returns {Promise.<*, Error>} Resolves with a response message
     */
    requestified.onrequest = function (message) {
      // this function must be implemented by the socket
      return Promise.reject('No onrequest handler implemented');
    };

    // TODO: disable send and onmessage on the requestified socket

    return requestified;
  })();
}

module.exports = requestify;
