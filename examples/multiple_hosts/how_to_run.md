# Multiple hosts

To run the example with multiple hosts:

- Start `host1.js` in one terminal:
 
        node host1.js
      
- Start `host2.js` in another terminal:

        node host2.js
      
- peer2 located on host2 will then send a message to peer1 located on host1,
  and peer1 will reply.
