const NodeCache = require('node-cache');

const cache = new NodeCache({
  stdTTL: 300,  // 5 minutes default TTL
  checkperiod: 60,  // Check for expired keys every 60 seconds
  useClones: false
});

module.exports = cache;