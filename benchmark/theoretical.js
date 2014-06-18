// theoretical maximum speed of receiving messages on a listener
var Emitter = require('emitter-component');

var count = 1e6;

var received = 0;
function onMessage (sender, message) {
  received++;
}

function testPlain () {
  // plain js
  var plainTimer = 'Sending ' + count + ' messages to a listener with plain js';
  console.time(plainTimer);

  for (var i = 0; i < count; i++) {
    onMessage('sender', 'the message');
  }

  console.timeEnd(plainTimer);
}

function testEmitter () {
  var emitterTimer = 'Sending ' + count + ' messages to a listener with event emitter';
  console.time(emitterTimer);

  var peer = {};
  Emitter(peer);
  peer.on('message', onMessage);

  for (var i = 0; i < count; i++) {
    peer.emit('message', 'sender', 'the message');
  }

  console.timeEnd(emitterTimer);
}


function testCustom () {
  var customTimer = 'Sending ' + count + ' messages to a listener with custom event emitter';
  console.time(customTimer);

  var slice = Array.prototype.slice;

  var peer = {};
  peer.listeners = {};
  peer.on = function (event, callback) {
    if (!(event in this.listeners)) this.listeners[event] = [];
    this.listeners[event].push(callback);
  };
  peer.emit = function (event) {
    var args = slice.call(arguments, 1);
    var listeners = this.listeners[event];
    if (listeners) {
      for (var i = 0, ii = listeners.length; i < ii; i++) {
        var listener = listeners[i];
        listener.apply(listener, args);
      }
    }
  };

  peer.on('message', onMessage);


  for (var i = 0; i < count; i++) {
    peer.emit('message', 'sender', 'the message');
  }

  console.timeEnd(customTimer);
}


function testCustom2 () {
  var customTimer = 'Sending ' + count + ' messages to a listener with custom event emitter 2';
  console.time(customTimer);

  var peer = {};
  peer.listeners = {};
  peer.on = function (event, callback) {
    if (!(event in this.listeners)) this.listeners[event] = [];
    this.listeners[event].push(callback);
  };
  peer.emit = function (event, sender, message) {
    var listeners = this.listeners[event];
    if (listeners) {
      for (var i = 0, ii = listeners.length; i < ii; i++) {
        var listener = listeners[i];
        listener(sender, message);
      }
    }
  };

  peer.on('message', onMessage);


  for (var i = 0; i < count; i++) {
    peer.emit('message', 'sender', 'the message');
  }

  console.timeEnd(customTimer);
}

function testCustom3 () {
  var customTimer = 'Sending ' + count + ' messages to a listener with custom event emitter 3';
  console.time(customTimer);

  var peer = {};
  peer.listeners = {};
  peer.on = function (event, callback) {
    this.listeners[event] = callback;
  };
  peer.emit = function (event, sender, message) {
    var listener = this.listeners[event];
    if (listener) {
      listener(sender, message);
    }
  };

  peer.on('message', onMessage);


  for (var i = 0; i < count; i++) {
    peer.emit('message', 'sender', 'the message');
  }

  console.timeEnd(customTimer);
}


function testCustom3b () {
  var customTimer = 'Sending ' + count + ' messages to a listener with custom event emitter 3b';
  console.time(customTimer);

  var peer = {};
  peer.emit = function (event, sender, message) {
    if (this.onmessage) {
      this.onmessage(sender, message);
    }
  };

  peer.onmessage = onMessage;

  for (var i = 0; i < count; i++) {
    peer.emit('sender', 'the message');
  }

  console.timeEnd(customTimer);
}

function testCustom4 () {
  var customTimer = 'Sending ' + count + ' messages to a listener with custom event emitter 4';
  console.time(customTimer);

  var peer = {};
  peer.listeners = {};
  peer.on = function (event, callback) {
    if (!(event in this.listeners)) this.listeners[event] = [];
    this.listeners[event].push(callback);
  };
  peer.emit = function (event) {
    var args = [];
    for (var a = 1, aa = arguments.length - 1; a < aa; a++) {
      args[a-1] = arguments[a];
    }

    var listeners = this.listeners[event];
    if (listeners) {
      for (var i = 0, ii = listeners.length; i < ii; i++) {
        var listener = listeners[i];
        listener.apply(listener, args);
      }
    }
  };

  peer.on('message', onMessage);


  for (var i = 0; i < count; i++) {
    peer.emit('message', 'sender', 'the message');
  }

  console.timeEnd(customTimer);
}

function testCustom5 () {
  var customTimer = 'Sending ' + count + ' messages to a listener with custom event emitter 5';
  console.time(customTimer);

  function sliceArgs(args, start, end) {
    var array = [];
    for (var a = start, aa = (end !== undefined) ? end : args.length; a < aa; a++) {
      array[a-start] = args[a];
    }
    return array;
  }

  /*
  function test() {
    console.log(sliceArgs(arguments, 1))
  }
  test(0,1,2,3,4,5,6);
  function test2() {
    console.log(sliceArgs(arguments, 2, 4))
  }
  test2(0,1,2,3,4,5,6);
  */

  var peer = {};
  peer.listeners = {};
  peer.on = function (event, callback) {
    if (!(event in this.listeners)) this.listeners[event] = [];
    this.listeners[event].push(callback);
  };
  peer.emit = function (event) {
    var args = sliceArgs(arguments, 1);

    var listeners = this.listeners[event];
    if (listeners) {
      for (var i = 0, ii = listeners.length; i < ii; i++) {
        var listener = listeners[i];
        listener.apply(listener, args);
      }
    }
  };

  peer.on('message', onMessage);


  for (var i = 0; i < count; i++) {
    peer.emit('message', 'sender', 'the message');
  }

  console.timeEnd(customTimer);
}

function testCustom6 () {
  var customTimer = 'Sending ' + count + ' messages to a listener with custom event emitter 6';
  console.time(customTimer);

  function slicerFactory(start, end) {
    if (end === undefined) {
      return function sliceArgs(args) {
        var array = [];
        for (var a = start, aa = args.length; a < aa; a++) {
          array[a-start] = args[a];
        }
        return array;
      }
    }
    else {
      return function sliceArgs(args) {
        var array = [];
        for (var a = start; a < end; a++) {
          array[a-start] = args[a];
        }
        return array;
      }
    }
  }

  /*
  function test() {
    console.log(slicerFactory(1)(arguments))
  }
  test(0,1,2,3,4,5,6);
  function test2() {
    console.log(slicerFactory(2, 4)(arguments))
  }
  test2(0,1,2,3,4,5,6);
  */

  var slice = slicerFactory(1);
  var peer = {};
  peer.listeners = {};
  peer.on = function (event, callback) {
    if (!(event in this.listeners)) this.listeners[event] = [];
    this.listeners[event].push(callback);
  };
  peer.emit = function (event) {
    var args = slice(arguments);

    var listeners = this.listeners[event];
    if (listeners) {
      for (var i = 0, ii = listeners.length; i < ii; i++) {
        var listener = listeners[i];
        listener.apply(listener, args);
      }
    }
  };

  peer.on('message', onMessage);


  for (var i = 0; i < count; i++) {
    peer.emit('message', 'sender', 'the message');
  }

  console.timeEnd(customTimer);
}


testPlain();    // 3 ms
testEmitter();  // 661 ms
testCustom();   // 558 ms
testCustom2();  // 9 ms    (winner)
testCustom3();  // 12 ms
testCustom3b();  // 4 ms   (also winner)
testCustom4();  // 73 ms
testCustom5();  // 137 ms
testCustom6();  // 124 ms

// Conclusion: slicing arguments is very slow