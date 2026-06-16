const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisPassword = process.env.REDIS_PASSWORD;
const useTls = process.env.REDIS_TLS === 'true';

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: redisPassword,
  db: parseInt(process.env.REDIS_DB || '0'),
};

if (useTls) {
  redisConfig.tls = {
    rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false',
  };
}

const redis = new Redis(redisConfig);

redis.on('error', (err) => console.error('Redis Client Error', err));
redis.on('connect', () => console.log('Redis connected successfully'));

module.exports = redis;
