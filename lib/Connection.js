/**
 * TODO: implement and use Connection, to take care of a WebSocket between two hosts:
 * - open the connection
 * - send rpc messages (requestify the socket)
 * - reconnect on connection errors
 *
 * https://github.com/joewalnes/reconnecting-websocket/blob/master/reconnecting-websocket.js
 * http://stackoverflow.com/questions/19691996/nodejs-websocket-how-to-reconnect-when-server-restarts
 *
 * API
 * 
 * new Connection(url)
 *
 * Connection.open()
 * Connection.close()
 *
 * Connection.request()
 * Connection.notify()
 *
 */
