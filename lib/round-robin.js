/*
{
  // Function to create a new task consumer
  spinUp: Function
  // Function to destroy a task consumer (Optional)
  spinDown: Function
  // Maximum number of consumers to spin up (Optional - 2)
  maxUp: Number
  // Max time consumers should live before spinDown is called (Optional - Infinity)
  ttl: Number
}
*/
function RoundRobin (opts) {
  
  opts.spinUp = opts.spinUp || function (cb) {cb()}
  opts.spinDown = opts.spinDown || function () {}
  opts.maxUp = opts.maxUp || 2
  opts.ttl = opts.ttl || Infinity
  
  this.opts = opts
  this.consumers = []
  this.consumersCount = 0
  this.currentConsumer = 0
}

function Consumer (consumer, ttl) {
  this.consumer = consumer
  this.expires = Date.now() + ttl
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
      this.consumers.push(new Consumer(consumer, this.opts.ttl))
      cb(null, consumer)
    }.bind(this))
  }
  
  var consumer = this.consumers[this.currentConsumer]
  
  // Do the spin down if expired
  if (consumer.expires < Date.now()) {
    this.consumers.splice(this.currentConsumer, 1)
    this.consumersCount--
    
    if (this.currentConsumer >= this.consumersCount) {
      this.currentConsumer = 0
    }
    
    this.opts.spinDown(consumer.consumer)
    return this.get(cb)
  }
  
  this.currentConsumer++
  
  if (this.currentConsumer >= this.consumersCount) {
    this.currentConsumer = 0
  }
  
  cb(null, consumer.consumer)
}

module.exports.RoundRobin = RoundRobin