var RoundRobin = require("../").RoundRobin
  , assert = require("assert")
  , async = require("async")

describe("RoundRobin", function () {
  
  it("should not spin up more than maxUp consumers for maxAge=Infinity & maxUsage=Infinity", function (done) {
    this.timeout(5000)
    
    var spinUpCount = 0
    
    var scheduler = new RoundRobin({
      spinUp: function (cb) {
        spinUpCount++
        cb(null, {usage: 0})
      },
      maxUp: 5
    })
    
    var tasks = []
    
    function createUsageTask (id) {
      return function (cb) {
        setTimeout(function () {
          console.log("Getting consumer", id);
          scheduler.get(function (er, consumer) {
            if (er) return cb(er)
            consumer.usage++
            cb(er, consumer)
          })
        }, Math.floor(Math.random()*25))
      }
    }
    
    for(var i = 0; i < 100; i++) {
      tasks.push(createUsageTask(i))
    }
    
    async.series(tasks, function (er, consumers) {
      assert.ifError(er)
      
      // 5 consumers should have been spun up
      assert.equal(5, spinUpCount)
      
      // Dedupe the consumers array
      consumers = consumers.filter(function(consumer, i) {
        return consumers.indexOf(consumer) == i
      })
      
      var usageCount = consumers.reduce(function (count, consumer, i) {
        console.log("Consumer", i, "usage is", consumer.usage);
        return count + consumer.usage
      }, 0)
      
      // All of the consumers should have been used 100 times
      assert.equal(100, usageCount)
      
      done()
    })
  })
})