import { createClient } from 'redis'

const redisHost = process.env.REDIS_HOST || 'localhost'
const redisPort = process.env.REDIS_PORT || '6379'
const redisPassword = process.env.REDIS_PASSWORD
const redisUrl = process.env.REDIS_URL || `redis://${redisHost}:${redisPort}`
const useTls = process.env.REDIS_TLS === 'true'

const clientConfig: any = {
  url: redisUrl,
  password: redisPassword,
  database: parseInt(process.env.REDIS_DB || '0'),
  socket: {
    reconnectStrategy: (retries: number) => {
      if (retries > 20) {
        return new Error('Too many retries to Redis')
      }
      return Math.min(retries * 100, 3000)
    },
    connectTimeout: 10000,
    lazyConnect: false
  }
}

if (useTls) {
  clientConfig.socket.tls = {
    rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false',
  }
}

const redis = createClient(clientConfig)

redis.on('error', (err) => console.error('Redis Client Error', err))
redis.on('connect', () => {})
redis.on('reconnecting', () => {})

// Connect to Redis (this is async, but we'll connect lazily)
let connectionPromise: Promise<void> | null = null

const ensureConnected = async () => {
  if (!connectionPromise) {
    connectionPromise = redis.connect().then(() => {
    }).catch((err) => {
      console.error('Redis connection failed:', err)
      connectionPromise = null
      throw err
    })
  } else if (redis.isOpen === false) {
    // Connection was closed, try to reconnect
    connectionPromise = null
    return ensureConnected()
  }
  await connectionPromise
}

export { redis, ensureConnected }
