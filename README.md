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

Here a simple usage example:

```js
// load the library
var distribus = require('distribus'),
    Promise = distribus.Promise;

// create an instance
var bus = new distribus();

// create two peers
Promise.all([
      bus.create('peer1'), 
      bus.create('peer2')
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

        // remove both peers from the bus
        bus.remove(peer1);
        bus.remove(peer2);
      });

      // send a message from peer2 to peer1
      peer2.send('peer1', 'Hi peer1!');
    });
```

## API

TODO: describe the API


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


