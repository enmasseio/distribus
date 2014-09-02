# History


## 2014-09-02, version 0.4.0

- Function `host.send(from, to, message)` is now publicly available.
- Implemented support for setting a property `networkId` on a Host.


## 2014-07-30, version 0.3.0

- Implemented `Host.config`, with options `reconnectTimeout`, `reconnectDelay` 
  and `reconnectDecay`.
- Implemented automatic reconnection of hosts.
- Throws meaningful errors when sending a message to non-existing, deleted,
  or unreachable peers.


## 2014-07-28, version 0.2.0

- Implemented support for publish/subscribe in the peer-to-peer network.
- Implemented `Host.get(id)` to get an existing Peer by its id.
- Changed `Host.create(id)` and `Host.remove(id)` to a synchronous calls 
  (instead of returning Promises).
- Fixed a bug in cleaning up after failing to connect to a non-existing host.


## 2014-06-02, version 0.1.0

- Initial release: basic support connecting hosts in a peer-to-peer network and
  sending messages between peers.
