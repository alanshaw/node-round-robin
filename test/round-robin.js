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
          scheduler.ret(consumer)
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
            scheduler.ret(consumer)
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
  
  it("should lazily spin down consumers when expired", function (done) {
    
    var spunUpConsumers = []
      , spunDownConsumers = []
    
    var scheduler = new RoundRobin({
      spinUp: function (cb) {
        var consumer = {destroyed: false}
        spunUpConsumers.push(consumer)
        cb(null, consumer)
      },
      spinDown: function (consumer, cb) {
        consumer.destroyed = true
        spunDownConsumers.push(consumer)
        cb()
      },
      maxUp: 2,
      maxAge: 500
    })
    
    // Create 2 consumers
    scheduler.get(function (er, c1) {
      assert.ifError(er)
      assert(c1)
      
      assert.equal(1, spunUpConsumers.length)
      assert.equal(0, spunDownConsumers.length)
      
      scheduler.get(function (er, c2) {
        assert.ifError(er)
        assert(c2)
        
        assert.equal(2, spunUpConsumers.length)
        assert.equal(0, spunDownConsumers.length)
        
        scheduler.ret(c1)
        scheduler.ret(c2)
        
        // Get 2 more consumers once the current two have expired
        setTimeout(function () {
          
          // Because the scheduler lazily spins down consumers, here, we should not have any destroyed consumers
          assert.equal(2, spunUpConsumers.length)
          assert.equal(0, spunDownConsumers.length)
          
          spunUpConsumers.forEach(function (consumer) {
            assert(!consumer.destroyed)
          })
          
          // Now get (and hopefully create) two more consumers
          scheduler.get(function (er, c1) {
            
            scheduler.get(function (er, c2) {
              assert.equal(4, spunUpConsumers.length)
              assert.equal(2, spunDownConsumers.length)
              
              scheduler.ret(c1)
              scheduler.ret(c2)
              
              done()
            })
          })
        }, 1000)
      })
    })
  })
  
  it("should eagerly spin down consumers when expired", function (done) {
    this.timeout(3000)
    
    var spunUpConsumers = []
      , spunDownConsumers = []
    
    var scheduler = new RoundRobin({
      spinUp: function (cb) {
        var consumer = {destroyed: false}
        spunUpConsumers.push(consumer)
        cb(null, consumer)
      },
      spinDown: function (consumer, cb) {
        consumer.destroyed = true
        spunDownConsumers.push(consumer)
        cb()
      },
      maxUp: 2,
      maxAge: 500,
      lazySpinDown: false
    })
    
    // Create 2 consumers
    scheduler.get(function (er, c1) {
      assert.ifError(er)
      assert(c1)
      
      assert.equal(1, spunUpConsumers.length)
      assert.equal(0, spunDownConsumers.length)
      
      scheduler.get(function (er, c2) {
        assert.ifError(er)
        assert(c2)
        
        assert.equal(2, spunUpConsumers.length)
        assert.equal(0, spunDownConsumers.length)
        
        scheduler.ret(c1)
        scheduler.ret(c2)
        
        // Get 2 more consumers once the current two have expired
        setTimeout(function () {
          
          // Because the scheduler eagerly spins down consumers, here, we should have destroyed the two consumers
          assert.equal(2, spunUpConsumers.length)
          assert.equal(2, spunDownConsumers.length)
          
          spunUpConsumers.forEach(function (consumer) {
            assert(consumer.destroyed)
          })
          
          // Now get (and hopefully create) two more consumers
          scheduler.get(function (er, c1) {
            scheduler.get(function (er, c2) {
              assert.equal(4, spunUpConsumers.length)
              assert.equal(2, spunDownConsumers.length)
              
              scheduler.ret(c1)
              scheduler.ret(c2)
              
              done()
            })
          })
        }, 2000)
      })
    })
  })
  
  it("should lazily spin down consumers when used up", function (done) {
    
    var spunUpConsumers = []
      , spunDownConsumers = []
    
    var scheduler = new RoundRobin({
      spinUp: function (cb) {
        var consumer = {destroyed: false}
        spunUpConsumers.push(consumer)
        cb(null, consumer)
      },
      spinDown: function (consumer, cb) {
        consumer.destroyed = true
        spunDownConsumers.push(consumer)
        cb()
      },
      maxUp: 2,
      maxUsage: 1
    })
    
    // Create 2 consumers
    scheduler.get(function (er, c1) {
      assert.ifError(er)
      assert(c1)
      
      assert.equal(1, spunUpConsumers.length)
      assert.equal(0, spunDownConsumers.length)
      
      scheduler.get(function (er, c2) {
        assert.ifError(er)
        assert(c2)
        
        assert.equal(2, spunUpConsumers.length)
        assert.equal(0, spunDownConsumers.length)
        
        scheduler.ret(c1)
        scheduler.ret(c2)
        
        // Get 2 more consumers once the current two have expired
        setTimeout(function () {
          
          // Because the scheduler lazily spins down consumers, here, we should not have any destroyed consumers
          assert.equal(2, spunUpConsumers.length)
          assert.equal(0, spunDownConsumers.length)
          
          spunUpConsumers.forEach(function (consumer) {
            assert(!consumer.destroyed)
          })
          
          // Now get (and hopefully create) two more consumers
          scheduler.get(function (er, c1) {
            scheduler.get(function (er, c2) {
              assert.equal(4, spunUpConsumers.length)
              assert.equal(2, spunDownConsumers.length)
              
              scheduler.ret(c1)
              scheduler.ret(c2)
          
              done()
            })
          })
        }, 1000)
      })
    })
  })
  
  it("should eagerly spin down consumers when used up", function (done) {
    this.timeout(3000)
    
    var spunUpConsumers = []
      , spunDownConsumers = []
    
    var scheduler = new RoundRobin({
      spinUp: function (cb) {
        var consumer = {destroyed: false}
        spunUpConsumers.push(consumer)
        cb(null, consumer)
      },
      spinDown: function (consumer, cb) {
        consumer.destroyed = true
        spunDownConsumers.push(consumer)
        cb()
      },
      maxUp: 2,
      maxUsage: 1,
      lazySpinDown: false
    })
    
    // Create 2 consumers
    scheduler.get(function (er, c1) {
      assert.ifError(er)
      assert(c1)
      
      assert.equal(1, spunUpConsumers.length)
      assert.equal(0, spunDownConsumers.length)
      
      scheduler.get(function (er, c2) {
        assert.ifError(er)
        assert(c2)
        
        assert.equal(2, spunUpConsumers.length)
        assert.equal(0, spunDownConsumers.length)
        
        scheduler.ret(c1)
        scheduler.ret(c2)
        
        // Get 2 more consumers once the current two have expired
        setTimeout(function () {
          
          // Because the scheduler eagerly spins down consumers, here, we should have destroyed the two consumers
          assert.equal(2, spunUpConsumers.length)
          assert.equal(2, spunDownConsumers.length)
          
          spunUpConsumers.forEach(function (consumer) {
            assert(consumer.destroyed)
          })
          
          // Now get (and hopefully create) two more consumers
          scheduler.get(function (er, c1) {
            scheduler.get(function (er, c2) {
              assert.equal(4, spunUpConsumers.length)
              assert.equal(2, spunDownConsumers.length)
              
              scheduler.ret(c1)
              scheduler.ret(c2)
              
              done()
            })
          })
        }, 2000)
      })
    })
  })
  
  it("should spin down consumers when destroyed", function (done) { 
    
    var scheduler = new RoundRobin({
      spinUp: function (cb) {
        cb(null, {destroyed: false})
      },
      spinDown: function (consumer, cb) {
        consumer.destroyed = true
        cb()
      }
    })
    
    scheduler.get(function (er, consumer) {
      assert.ifError(er)
      assert.strictEqual(false, consumer.destroyed)
      
      scheduler.ret(consumer)
      
      scheduler.destroy(function () {
        assert(consumer.destroyed)
        done()
      })
    })
  })
})