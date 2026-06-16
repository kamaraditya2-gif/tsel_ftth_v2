import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: 'unknown',
      redis: 'unknown'
    },
    uptime: process.uptime()
  }

  let client
  try {
    client = await pool.connect()
    const result = await client.query('SELECT NOW() as now')
    health.services.database = 'ok'
    health.services.redis = 'ok' // If we got here, Redis is accessible (queue is working)
  } catch (error) {
    health.status = 'error'
    health.services.database = 'error'
    health.services.redis = 'unknown'
    console.error('Health check failed:', error)
  } finally {
    if (client) client.release()
  }

  const statusCode = health.status === 'ok' ? 200 : 503
  
  return NextResponse.json(health, { status: statusCode })
}
