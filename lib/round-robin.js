var async = require("async")
  , events = require("events")
  , util = require("util")

/**
 * Create a new round robin scheduler
 * 
 * @param {Object} opts
 * @param {Function} opts.spinUp Function to create a new task consumer
 * @param {Function} [opts.spinDown] Function to destroy a task consumer (Optional)
 * @param {Number} [opts.maxUp] Maximum number of consumers to spin up (Optional - 2)
 * @param {Number} [opts.maxUsage] Maximum tasks consumers should receive before spinDown is called (Optional - Infinity)
 * @param {Number} [opts.maxAge] Maximum time in millis consumers should live for before spinDown is called (Optional - Infinity)
 * @param {Boolean} [opts.lazySpinDown] Spin down consumers lazily (Optional - true)
*/
function RoundRobin (opts) {
  
  events.EventEmitter.call(this)
  
  this.setMaxListeners(1000)
  
  opts = opts || {}
  opts.spinUp = opts.spinUp || function (cb) {cb()}
  opts.spinDown = opts.spinDown || function (_, cb) {cb()}
  opts.maxUp = opts.maxUp || 2
  opts.maxUsage = opts.maxUsage || Infinity
  opts.maxAge = opts.maxAge || Infinity
  opts.lazySpinDown = opts.lazySpinDown === undefined ? true : opts.lazySpinDown
  
  this.opts = opts
  this.consumers = []
  this.consumersPending = 0
  this.currentConsumer = 0
  
  if (!opts.lazySpinDown) {
    var noop = function () {}
    this.eagerSpinDownIntervalId = setInterval(function() {
      this.consumers.forEach(function (consumer) {
        spinDownIf.call(this, consumer, noop)
      }.bind(this))
    }.bind(this), 250)
  }
}

util.inherits(RoundRobin, events.EventEmitter)

// Spin down if the consumer is expired or reached its max usage
// Callback gets a boolean to say whether the consumer was spun down or not
function spinDownIf (consumer, cb) {
  // Do the spin down if expired or done too much work
  if (!consumer.inUse && (consumer.expires < Date.now() || consumer.usage >= this.opts.maxUsage)) {
    this.consumers.splice(this.consumers.indexOf(consumer), 1)
    
    return this.opts.spinDown(consumer.consumer, function (er) {
      if (er) return cb(er, false)
      
      cb(null, true)
      this.emit("spinDown")
      
    }.bind(this))
  }
  cb(null, false)
}

// Spin up if the number of active and pending consumers is less than the max allowed
function spinUpIf (cb) {
  // Do the spin up if we still have space
  if ((this.consumers.length + this.consumersPending) < this.opts.maxUp) {
    this.consumersPending++
    
    return this.opts.spinUp(function (er, consumer) {
      this.consumersPending--
      
      if (er) return cb(er)
      
      consumer = new Consumer(consumer, this.opts.maxAge)
      
      this.consumers.push(consumer)
      
      cb(null, consumer)
      this.emit("spinUp")
      
    }.bind(this))
  }
  cb()
}

function allConsumersInUse () {
  for (var i = 0; i < this.consumers.length; ++i) {
    if (!this.consumers[i].inUse) {
      return false
    } 
  }
  return true
}

function nextConsumer () {
  var consumer
  
  while (!consumer) {
    if (this.currentConsumer >= this.consumers.length) {
      this.currentConsumer = 0
    }
    
    consumer = this.consumers[this.currentConsumer].inUse ? null : this.consumers[this.currentConsumer]
    
    this.currentConsumer++
  }
  return consumer
}

// Get the next task consumer
RoundRobin.prototype.get = function (cb) {
  
  spinUpIf.call(this, function (er, consumer) {
    if (er) return cb(er)
    
    if (consumer) {
      consumer.usage++
      consumer.inUse = true
      
      return cb(null, consumer.consumer)
    }
    
    // No consumers, all pending!
    if (this.consumers.length == 0 && this.consumersPending == this.opts.maxUp) {
      //console.log("All consumers pending")
      // Once a pending consumer has been spun up, get it!
      return this.once("spinUp", function () {
        this.get(cb)
      }.bind(this))
    }
    
    // No consumers, all in use!
    if (allConsumersInUse.call(this)) {
      // Once an in use consumer has been returned, use it!
      return this.once("ret", function () {
        this.get(cb)
      }.bind(this))
    }
    
    consumer = nextConsumer.call(this)
    
    // If we're lazily spinning down, we need to check if this consumer has expired or is used up
    if (this.opts.lazySpinDown) {
      return spinDownIf.call(this, consumer, function (er, didSpinDown) {
        if (er) return cb(er)
        
        if (didSpinDown) {
          return this.get(cb)
        }
        
        consumer.usage++
        consumer.inUse = true
        
        cb(null, consumer.consumer)
        
      }.bind(this))
    }
    
    consumer.usage++
    consumer.inUse = true
    
    cb(null, consumer.consumer)
    
  }.bind(this))
}

RoundRobin.prototype.ret = function (consumer) {
  for (var i = 0; i < this.consumers.length; ++i) {
    if (this.consumers[i].consumer === consumer) {
      this.consumers[i].inUse = false
      return this.emit("ret")
    }
  }
  throw new Error("Tried to return a consumer the scheduler didn't own")
}

RoundRobin.prototype.destroy = function (cb) {
  
  clearInterval(this.eagerSpinDownIntervalId)
  
  var spinDownTasks = this.consumers.map(function (consumer) {
    return function (cb) {
      this.opts.spinDown(consumer.consumer, cb)
    }.bind(this)
  }.bind(this))
  
  async.parallel(spinDownTasks, cb)
}

function Consumer (consumer, maxAge) {
  this.consumer = consumer
  this.expires = Date.now() + maxAge
  this.usage = 0
  this.inUse = false
}

module.exports.RoundRobin = RoundRobin