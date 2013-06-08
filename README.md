Round Robin [![Dependency Status](https://david-dm.org/alanshaw/node-round-robin.png)](https://david-dm.org/alanshaw/node-round-robin) [![Build Status](https://travis-ci.org/alanshaw/node-round-robin.png)](https://travis-ci.org/alanshaw/node-round-robin)
===

NOT READY FOR USE.

Create consumers that expire after a certain time period or task count that are schedulised to be used in a round robin fashion.

How to
---

```javascript

var RoundRobin = require("round-robin").RoundRobin

var scheduler = new RoundRobin({

  // Create a new thing to do tasks
  spinUp: function (cb) {
    var thing = {doTask: function() {}, destroy: function() {}};
    cb(null, thing); // Remember to call the callback when ready
  },
  
  // Tear down the thing, it won't be used again!
  spinDown: function(thing, cb) {
    thing.destroy();
    cb(); // Remember to call the callback when done!
  },
  
  maxUp: 10, // Allow at most 10 things to be spun up at once
  maxTasks: 100, // Allow the thing to be used 100 times before it is spun down
  maxAge: 1000 * 60 * 60, // Allow the thing to live for an hour before it is spun down
  lazySpinDown: true // Spin down lazily (avoids the polling interval processing)
});

// Use the scheduler to get a thing and perform a task every second
setInterval(function () {
  scheduler.get(function (er, thing) {
    thing.doTask();
  })
}, 1000);

// Finish doing tasks after 5 minutes
setTimeout(function () {
  scheduler.destroy(function (er) {
    console.log("Finished doing tasks");
  })
}, 1000 * 60 * 5);

```