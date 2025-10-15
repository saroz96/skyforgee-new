const NodeCache = require('node-cache');
const myCache = new NodeCache({ 
  stdTTL: 300, // Default TTL: 5 minutes (300 seconds)
  checkperiod: 60 // Check for expired entries every 60 seconds
});