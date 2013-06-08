module.exports = process.env.ROUNDROBIN_COV
  ? require('./lib-cov/round-robin')
  : require('./lib/round-robin')