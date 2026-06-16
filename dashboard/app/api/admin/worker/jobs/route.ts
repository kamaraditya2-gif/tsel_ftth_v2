import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { createClient } from 'redis'

function createRedisClient() {
  return createClient({
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      connectTimeout: 5000,
      reconnectStrategy: (retries) => {
        if (retries > 3) {
          return new Error('Redis reconnection failed')
        }
        return Math.min(retries * 100, 1000)
      }
    },
    password: process.env.REDIS_PASSWORD,
  })
}

const QUEUES = ['acs-fast', 'acs-download', 'acs-upload']

async function getJobsFromQueue(redis: any, queueName: string, limit: number, state: string) {
  const queueKey = `bull:${queueName}`
  const jobs: any[] = []

  // Check if queue exists
  const keys = await redis.keys(`bull:${queueName}:*`)
  if (keys.length === 0) {
    return jobs
  }

  const perQueueLimit = Math.max(1, Math.ceil(limit / QUEUES.length))

  if (state === 'all' || state === 'completed') {
    try {
      const completedKey = `${queueKey}:completed`
      const completedType = await redis.type(completedKey)
      if (completedType === 'none' || completedType === 'list') {
        if (completedType !== 'none' && completedType !== 'list') {
          await redis.del(completedKey)
        }
        const completedIds = await redis.lRange(completedKey, 0, perQueueLimit - 1)
        for (const id of completedIds) {
          const jobData = await redis.hGet(`${queueKey}:${id}`, 'data')
          const jobResult = await redis.hGet(`${queueKey}:${id}`, 'returnvalue')
          const jobFailed = await redis.hGet(`${queueKey}:${id}`, 'failedReason')
          
          if (jobData) {
            const parsedData = JSON.parse(jobData)
            const jobTimestamp = await redis.hGet(`${queueKey}:${id}`, 'timestamp')
            const jobProcessedOn = await redis.hGet(`${queueKey}:${id}`, 'processedOn')
            const jobFinishedOn = await redis.hGet(`${queueKey}:${id}`, 'finishedOn')
            let deviceInfo = null
            if (parsedData.deviceId) {
              try {
                const deviceRes = await pool.query(
                  'SELECT serial_number, indihome_id FROM devices_ont WHERE id = $1',
                  [parsedData.deviceId]
                )
                if (deviceRes.rows.length > 0) {
                  deviceInfo = deviceRes.rows[0]
                }
              } catch (err) {
                // ignore
              }
            }
            
            jobs.push({
              id,
              queue: queueName,
              data: parsedData,
              deviceInfo,
              result: jobResult ? JSON.parse(jobResult) : null,
              failedReason: jobFailed,
              state: jobFailed ? 'failed' : 'completed',
              timestamp: jobTimestamp ? parseInt(jobTimestamp) : null,
              processedOn: jobProcessedOn ? parseInt(jobProcessedOn) : null,
              finishedOn: jobFinishedOn ? parseInt(jobFinishedOn) : null,
              processedBy: parsedData.processedBy || null,
            })
          }
        }
      }
    } catch (err) {
      // ignore
    }
  }
  
  if (state === 'all' || state === 'failed') {
    try {
      const failedKey = `${queueKey}:failed`
      const failedType = await redis.type(failedKey)
      if (failedType === 'none' || failedType === 'list') {
        if (failedType !== 'none' && failedType !== 'list') {
          await redis.del(failedKey)
        }
        const failedIds = await redis.lRange(failedKey, 0, perQueueLimit - 1)
        for (const id of failedIds) {
          const jobData = await redis.hGet(`${queueKey}:${id}`, 'data')
          const jobFailed = await redis.hGet(`${queueKey}:${id}`, 'failedReason')
          const jobTimestamp = await redis.hGet(`${queueKey}:${id}`, 'timestamp')
          const jobProcessedOn = await redis.hGet(`${queueKey}:${id}`, 'processedOn')
          const jobFinishedOn = await redis.hGet(`${queueKey}:${id}`, 'finishedOn')
          
          if (jobData) {
            const parsedData = JSON.parse(jobData)
            let deviceInfo = null
            if (parsedData.deviceId) {
              try {
                const deviceRes = await pool.query(
                  'SELECT serial_number, indihome_id FROM devices_ont WHERE id = $1',
                  [parsedData.deviceId]
                )
                if (deviceRes.rows.length > 0) {
                  deviceInfo = deviceRes.rows[0]
                }
              } catch (err) {
                // ignore
              }
            }
            
            jobs.push({
              id,
              queue: queueName,
              data: parsedData,
              deviceInfo,
              failedReason: jobFailed,
              state: 'failed',
              timestamp: jobTimestamp ? parseInt(jobTimestamp) : null,
              processedOn: jobProcessedOn ? parseInt(jobProcessedOn) : null,
              finishedOn: jobFinishedOn ? parseInt(jobFinishedOn) : null,
              processedBy: parsedData.processedBy || null,
            })
          }
        }
      }
    } catch (err) {
      // ignore
    }
  }
  
  if (state === 'all' || state === 'active') {
    try {
      const activeIds = await redis.lRange(`${queueKey}:active`, 0, perQueueLimit - 1)
      for (const id of activeIds) {
        const jobData = await redis.hGet(`${queueKey}:${id}`, 'data')
        const jobProgress = await redis.hGet(`${queueKey}:${id}`, 'progress')
        const jobTimestamp = await redis.hGet(`${queueKey}:${id}`, 'timestamp')
        const jobProcessedOn = await redis.hGet(`${queueKey}:${id}`, 'processedOn')
        
        if (jobData) {
          const parsedData = JSON.parse(jobData)
          let deviceInfo = null
          if (parsedData.deviceId) {
            try {
              const deviceRes = await pool.query(
                'SELECT serial_number, indihome_id FROM devices_ont WHERE id = $1',
                [parsedData.deviceId]
              )
              if (deviceRes.rows.length > 0) {
                deviceInfo = deviceRes.rows[0]
              }
            } catch (err) {
              // ignore
            }
          }
          
          jobs.push({
            id,
            queue: queueName,
            data: parsedData,
            deviceInfo,
            progress: jobProgress ? JSON.parse(jobProgress) : null,
            state: 'active',
            timestamp: jobTimestamp ? parseInt(jobTimestamp) : null,
            processedOn: jobProcessedOn ? parseInt(jobProcessedOn) : null,
            finishedOn: null,
            processedBy: parsedData.processedBy || null,
          })
        }
      }
    } catch (err) {
      // ignore
    }
  }

  return jobs
}

export async function GET(request: Request) {
  const redis = createRedisClient()
  try {
    await redis.connect()

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const state = searchParams.get('state') || 'all' // all, completed, failed, active

    // Fetch jobs from all three queues concurrently
    const allJobsArrays = await Promise.all(
      QUEUES.map(q => getJobsFromQueue(redis, q, limit, state))
    )

    const jobs = allJobsArrays.flat().slice(0, limit)

    return NextResponse.json({
      jobs,
      message: jobs.length === 0 ? 'No jobs found in queues' : undefined
    })
  } catch (error: any) {
    console.error('Jobs API error:', error)
    return NextResponse.json({ error: 'Failed to fetch jobs', detail: error.message }, { status: 500 })
  } finally {
    try { await redis.disconnect() } catch (_) {}
  }
}
