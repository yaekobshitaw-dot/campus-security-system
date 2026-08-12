const { createClient } = require('redis');
const dotenv = require('dotenv');

dotenv.config();

const redisOptions = {
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379
  }
};

if (process.env.REDIS_PASSWORD) {
  redisOptions.password = process.env.REDIS_PASSWORD;
}

const client = createClient(redisOptions);
client.on('error', (err) => {
  console.warn('Redis client error:', err.message);
});

module.exports = client;
