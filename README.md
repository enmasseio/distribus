# distribus

A scalable, distributed message bus for node.js and the browser.

Distribus can be used to:

- Send messages between peers
- Broadcast messages
- Publish/subscribe topics



## Install

Install the library via npm:

    npm install distribus
    

## Use

### A single host

```js
// load the library
var distribus = require('distribus'),
    Promise = distribus.Promise;

// create a host
var host = new distribus.Host();

// create two peers
Promise.all([
      host.create('peer1'), 
      host.create('peer2')
    ])
    .then(function (peers) {
      var peer1 = peers[0];
      var peer2 = peers[1];

      // listen for messages on peer1
      peer1.on('message', function (sender, message) {
        console.log(this.id + ' received a message from ' + sender + ': ' + message);

        // reply to the message
        peer1.send(sender, 'Thanks for your message');
      });

      // listen for messages on peer2
      peer2.on('message', function (sender, message) {
        console.log(this.id + ' received a message from ' + sender + ': ' + message);

        // remove both peers from the host
        host.remove(peer1);
        host.remove(peer2);
      });

      // send a message from peer2 to peer1
      peer2.send('peer1', 'Hi peer1!');
    });
```

### Multiple hosts

```js
var distribus = require('distribus'),
    Promise = distribus.Promise;

var host1 = new distribus.Host();
var host2 = new distribus.Host();

// create two hosts
Promise.all([
      host1.listen('127.0.0.1', 3000),
      host2.listen('127.0.0.1', 3001)
    ])

    // join the hosts
    .then(function () {
      return host1.join(host2.url);
    })

    // create two peers, one on host1 and one on host2
    .then(function () {
      return Promise.all([
        host1.create('peer1'),
        host2.create('peer2')
      ])
    })

    .then(function (peers) {
      var peer1 = peers[0];
      var peer2 = peers[1];

      // listen for messages
      peer1.on('message', function (from, message) {
        console.log(this.id + ' received a message from ' + from + ': ' + message);

        // send a message back
        peer1.send(from, 'Thanks for your message');
      });

      // listen for messages
      peer2.on('message', function (from, message) {
        console.log(this.id + ' received a message from ' + from + ': ' + message);

        // remove the peers
        host1.remove(peer1);
        host2.remove(peer2);
        peer1 = null;
        peer2 = null;

        // close the hosts
        host1.close();
        host2.close();
        host1 = null;
        host2 = null;
      });

      // send a message
      peer2.send('peer1', 'Hi peer1!');
    });
```


## API

### distribus

The distribus namespace contains the following prototypes:

- `distribus.Host`
- `distribus.Promise`

### Host

A Host can be created as 

```js
var host = new distribus.Host();
```

A Host has the following methods:

- `Host.create(id: string) : Promise.<Peer, Error>`
  Create a new `Peer`. Returns a promise which resolves with the new Peer.
  Rejects when a peer with the same id already exists.
- `Host.remove(peer: Peer | string): Promise.<null, Error>`
  Remove a peer from the host. The peer itself or it's id can be provided.
- `Host.find(id: string): Promise.<string, Error>`
  Find the host where the peer with given id is located. Rejects with an error
  when the peer is not found. Returns null when the peer is located on a host
  without url.
- `Host.listen(address: string, port: number): Promise.<Host, Error>`
  Start listening on a web socket server. Returns the host it self once 
  the server is started.
- `Host.join(address: string, port: number): Promise.<Host, Error>`
  Join another host, the hosts will form a network. Peers located on the 
  joined host can be contacted.
- `Host.close(): Promise.<Host, Error>`
  Close the hosts web server socket. Returns the host itself.


### Peer

A `Peer` can send and receive messages. A Peer can be created by a Host.

```js
var host = new distribus.Host();

host.create('peer1')
    .then(function (peer) {
      console.log(peer.id + ' created');
    })
    .catch(function (err) {
      console.log(err);
    });
```

A Peer has the following functions:

- `Peer.on(event, callback)`
  Listen for an event. Available events: 
  
  - `'message'`. Receive a message. Syntax:
    `Peer.on('message', function (sender : String, message: *) {...})`
  
- `Peer.send(recipient: String, message: *) : Promise.<null, Error>`
  Send a message to an other peer. The message must be valid JSON.


<!-- TODO: create a build script
## Build

First clone the project from github:

    git clone git://github.com/enmasseio/distribus.git
    cd distribus

Install the project dependencies:

    npm install

Then, the project can be build by executing the build script via npm:

    npm run build

This will build the library distribus.js and distribus.min.js from the source
files and put them in the folder dist.
-->


## Test

To execute tests for the library, install the project dependencies once:

    npm install

Then, the tests can be executed:

    npm test

To test code coverage of the tests:

    npm run coverage

To see the coverage results, open the generated report in your browser:

    ./coverage/lcov-report/index.html


## License

Copyright (C) 2014 Jos de Jong <wjosdejong@gmail.com>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.


