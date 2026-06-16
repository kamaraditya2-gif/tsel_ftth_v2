import { NextResponse } from 'next/server'
import { createClient } from 'redis'

const redis = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        return new Error('Too many reconnection attempts')
      }
      return Math.min(retries * 100, 5000)
    },
  },
  password: process.env.REDIS_PASSWORD,
})

redis.on('error', (err) => {
  console.error('Redis Client Error:', err)
})

redis.on('connect', () => {
  console.log('Redis Client Connected')
})

redis.on('reconnecting', () => {
  console.log('Redis Client Reconnecting')
})

async function ensureConnected() {
  if (!redis.isOpen) {
    await redis.connect()
  }
}

const QUEUES = ['acs-fast', 'acs-download', 'acs-upload']

async function getQueueStats(queueName: string) {
  const queueKey = `bull:${queueName}`
  const keys = await redis.keys(`bull:${queueName}:*`)
  const queueExists = keys.length > 0

  if (!queueExists) {
    return {
      name: queueName,
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: false,
      total: 0,
      exists: false
    }
  }

  const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
    redis.lLen(`${queueKey}:waiting`).catch(() => 0),
    redis.lLen(`${queueKey}:active`).catch(() => 0),
    redis.lLen(`${queueKey}:completed`).catch(() => 0),
    redis.lLen(`${queueKey}:failed`).catch(() => 0),
    redis.zCard(`${queueKey}:delayed`).catch(() => 0),
    redis.get(`${queueKey}:paused`).catch(() => null)
  ])

  return {
    name: queueName,
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused: paused === '1',
    total: waiting + active + delayed,
    exists: true
  }
}

export async function GET() {
  try {
    await ensureConnected()
    
    // Check if Redis is connected
    const ping = await redis.ping()
    if (ping !== 'PONG') {
      throw new Error('Redis not responding')
    }
    
    // Get worker heartbeat information
    const workersHash = await redis.hGetAll('acs-workers').catch(() => ({}))
    const workers = Object.values(workersHash).map(data => {
      try {
        return JSON.parse(data)
      } catch {
        return null
      }
    }).filter(w => w !== null)
    
    // Filter out workers that haven't sent heartbeat recently (older than 2 minutes)
    const now = new Date()
    const activeWorkers = workers.filter(w => {
      const lastHeartbeat = new Date(w.lastHeartbeat)
      const diff = now.getTime() - lastHeartbeat.getTime()
      return diff < 120000 // 2 minutes in milliseconds
    })
    
    // Get queue statistics from all three BullMQ queues
    const queueStats = await Promise.all(QUEUES.map(q => getQueueStats(q)))
    
    const totalWaiting = queueStats.reduce((sum, q) => sum + q.waiting, 0)
    const totalActive = queueStats.reduce((sum, q) => sum + q.active, 0)
    const totalCompleted = queueStats.reduce((sum, q) => sum + q.completed, 0)
    const totalFailed = queueStats.reduce((sum, q) => sum + q.failed, 0)
    const totalDelayed = queueStats.reduce((sum, q) => sum + q.delayed, 0)
    const anyExists = queueStats.some(q => q.exists)
    
    // Determine if worker is running based on active workers or jobs
    const isRunning = activeWorkers.length > 0 || totalActive > 0 || totalWaiting > 0
    
    return NextResponse.json({
      status: isRunning ? 'running' : 'stopped',
      queues: queueStats,
      aggregated: {
        waiting: totalWaiting,
        active: totalActive,
        completed: totalCompleted,
        failed: totalFailed,
        delayed: totalDelayed,
        total: totalWaiting + totalActive + totalDelayed,
        allJobs: totalWaiting + totalActive + totalCompleted + totalFailed + totalDelayed
      },
      workers: {
        count: activeWorkers.length,
        list: activeWorkers.map(w => w.id)
      },
      workerDetails: activeWorkers
    })
  } catch (error) {
    console.error('Worker status error:', error)
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Failed to get worker status'
    }, { status: 500 })
  }
}
