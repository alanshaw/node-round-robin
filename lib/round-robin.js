var async = require("async")

/*
{
  // Function to create a new task consumer
  spinUp: Function
  // Function to destroy a task consumer (Optional)
  spinDown: Function
  // Maximum number of consumers to spin up (Optional - 2)
  maxUp: Number
  // Maximum tasks consumers should receive before spinDown is called (Optional - Infinity)
  maxTasks: Number
  // Maximum millis consumers should live for before spinDown is called (Optional - Infinity)
  maxAge: Number
}
*/
function RoundRobin (opts) {
  
  opts.spinUp = opts.spinUp || function (cb) {cb()}
  opts.spinDown = opts.spinDown || function (_, cb) {cb()}
  opts.maxUp = opts.maxUp || 2
  opts.maxTasks = opts.maxTasks || Infinity
  opts.maxAge = opts.maxAge || Infinity
  
  this.opts = opts
  this.consumers = []
  this.consumersCount = 0
  this.currentConsumer = 0
}

// Get the next task consumer
RoundRobin.prototype.get = function (cb) {
  
  // Do the spin up if we still have space
  if (this.consumersCount < this.opts.maxUp) {
    this.consumersCount++
    return this.opts.spinUp(function (er, consumer) {
      if (er) {
        this.consumersCount--
        return cb(er)
      }
      this.consumers.push(new Consumer(consumer, this.opts.maxAge))
      cb(null, consumer)
    }.bind(this))
  }
  
  var consumer = this.consumers[this.currentConsumer]
  
  // Do the spin down if expired or done to much work
  if (consumer.expires < Date.now() || consumer.tasks > this.opts.maxTasks) {
    this.consumers.splice(this.currentConsumer, 1)
    this.consumersCount--
    
    if (this.currentConsumer >= this.consumersCount) {
      this.currentConsumer = 0
    }
    
    this.opts.spinDown(consumer.consumer, function (er) {
      if (er) return cb(er)
      this.get(cb)
    }.bind(this))
  }
  
  this.currentConsumer++
  
  if (this.currentConsumer >= this.consumersCount) {
    this.currentConsumer = 0
  }
  
  consumer.tasks++
  
  cb(null, consumer.consumer)
}

RoundRobin.prototype.destroy = function (cb) {
  
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
  this.tasks = 0
}

module.exports.RoundRobin = RoundRobin