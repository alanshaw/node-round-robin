var RoundRobin = require("../").RoundRobin
  , assert = require("assert")
  , async = require("async")

describe("RoundRobin", function () {
  
  it("should not spin up more than maxUp consumers for maxAge=Infinity & maxUsage=Infinity (series execution)", function (done) {
    this.timeout(5000)
    
    var spinUpCount = 0
    
    var scheduler = new RoundRobin({
      spinUp: function (cb) {
        spinUpCount++
        // Simulate some time passing before the spinUp is complete
        setTimeout(function () {
          console.log("Consumer", spinUpCount, "spun up")
          cb(null, {usage: 0})
        }, Math.floor(Math.random()*25));
      },
      maxUp: 5
    })
    
    var tasks = []
    
    function createUsageTask (i) {
      return function (cb) {
        console.log("Getting a consumer (task " + i + ")")
        scheduler.get(function (er, consumer) {
          if (er) return cb(er)
          consumer.usage++
          cb(er, consumer)
        })
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
        console.log("Consumer", i, "usage is", consumer.usage)
        
        // Since we're executing the tasks in series (we don't ask for another consumer before
        // we receive the last), we should expect all consumers to be used equally
        assert.equal(20, consumer.usage)
        
        return count + consumer.usage
      }, 0)
      
      // All of the consumers should have been used 100 times
      assert.equal(100, usageCount)
      
      done()
    })
  })
  
  it("should not spin up more than maxUp consumers for maxAge=Infinity & maxUsage=Infinity (parallel execution)", function (done) {
    this.timeout(5000)
    
    var spinUpCount = 0
    
    var scheduler = new RoundRobin({
      spinUp: function (cb) {
        var count = spinUpCount
        console.log("Consumer", count, "spin up requested")
        spinUpCount++
        // Simulate some time passing before the spinUp is complete
        setTimeout(function () {
          console.log("Consumer", count, "spun up")
          cb(null, {id: count, usage: 0})
        }, Math.floor(Math.random()*25));
      },
      maxUp: 5
    })
    
    var tasks = []
    
    function createUsageTask (i) {
      return function (cb) {
        // Execute the task at some random point in the future
        setTimeout(function () {
          console.log("Getting a consumer (task " + i + ")")
          scheduler.get(function (er, consumer) {
            if (er) return cb(er)
            consumer.usage++
            console.log("Consumer", consumer.id, "performed task")
            cb(er, consumer)
          })
        }, Math.floor(Math.random()*25))
      }
    }
    
    for(var i = 0; i < 100; i++) {
      tasks.push(createUsageTask(i))
    }
    
    async.parallel(tasks, function (er, consumers) {
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
  
  it("should spin down consumers when destroyed", function (done) {
    
    var consumer = {destroyed: false}
    
    var scheduler = new RoundRobin({
      spinUp: function (cb) {
        cb(null, consumer)
      },
      spinDown: function (consumer, cb) {
        consumer.destroyed = true
        cb()
      }
    })
    
    scheduler.get(function (er, consumer) {
      assert.ifError(er)
      assert.strictEqual(false, consumer.destroyed)
      
      scheduler.destroy(function () {
        assert(consumer.destroyed)
        done()
      })
    })
  })
})