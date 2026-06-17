import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { redis, ensureConnected } from '@/lib/redis'

export async function GET() {
  const health: any = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {},
    workers: {},
    regional: {},
    uptime: process.uptime()
  }

  let client
  try {
    client = await pool.connect()

    // 1. Database basic check
    await client.query('SELECT NOW() as now')
    health.services.database = 'ok'

    // 2. Redis check
    try {
      await ensureConnected()
      const pong = await redis.ping()
      health.services.redis = pong === 'PONG' ? 'ok' : 'error'
    } catch {
      health.services.redis = 'error'
      health.status = 'degraded'
    }

    // 3. Dispatcher check — apakah ada queue_jobs dibuat dalam 5 menit terakhir
    const dispRes = await client.query(
      `SELECT COUNT(*) as count FROM queue_jobs WHERE created_at > NOW() - INTERVAL '5 minutes'`
    )
    const dispatcherRecent = parseInt(dispRes.rows[0].count) > 0
    health.dispatcher = {
      status: dispatcherRecent ? 'ok' : 'idle',
      recent_jobs_5min: parseInt(dispRes.rows[0].count),
      note: dispatcherRecent ? 'Queue jobs created in last 5 min' : 'No recent queue jobs (may be idle)'
    }
    if (!dispatcherRecent) health.status = 'degraded'

    // 4. Worker heartbeat check via Redis
    try {
      const workersHash = await redis.hGetAll('acs-workers').catch(() => ({}))
      const workers = Object.values(workersHash)
        .map(data => {
          try { return JSON.parse(data as string) }
          catch { return null }
        })
        .filter(w => w !== null)

      const now = Date.now()
      const activeWorkers = workers.filter((w: any) => {
        const hb = new Date(w.lastHeartbeat).getTime()
        return (now - hb) < 120000
      })

      health.workers = {
        total: workers.length,
        active: activeWorkers.length,
        list: activeWorkers.map((w: any) => ({
          id: w.id,
          queue: w.queue,
          lastHeartbeat: w.lastHeartbeat,
          concurrency: w.concurrency
        }))
      }

      // Check queue stats
      const QUEUES = ['acs-fast', 'acs-download', 'acs-upload', 'acs-queue']
      const queueStats: any = {}
      for (const q of QUEUES) {
        const prefix = `bull:${q}`
        const [waiting, active] = await Promise.all([
          redis.lLen(`${prefix}:waiting`).catch(() => 0),
          redis.lLen(`${prefix}:active`).catch(() => 0),
        ])
        queueStats[q] = { waiting, active }
      }
      health.workers.queues = queueStats
    } catch {
      health.workers = { status: 'error', note: 'Failed to read worker heartbeats' }
    }

    // 5. Regional workers check — test_results_direct_ping dalam 90 menit terakhir
    const regionalRes = await client.query(`
      SELECT
        ds.id,
        ds.name,
        COUNT(drp.id) as ping_count,
        MAX(drp.created_at) as last_ping_at
      FROM downstream_servers ds
      LEFT JOIN test_results_direct_ping drp
        ON drp.downstream_server_id = ds.id
        AND drp.created_at > NOW() - INTERVAL '90 minutes'
      GROUP BY ds.id, ds.name
      ORDER BY ds.id
    `)

    const regional: any = {}
    let allRegionalOk = true
    for (const row of regionalRes.rows) {
      const pingCount = parseInt(row.ping_count)
      const alive = pingCount > 0
      regional[`id_${row.id}`] = {
        name: row.name,
        status: alive ? 'ok' : 'no_ping_30min',
        pings_30min: pingCount,
        last_ping: row.last_ping_at
      }
      if (!alive) allRegionalOk = false
    }
    health.regional = regional
    if (!allRegionalOk) {
      if (health.status === 'ok') health.status = 'degraded'
    }

  } catch (error) {
    health.status = 'error'
    health.services.database = 'error'
    health.error = error instanceof Error ? error.message : 'Unknown error'
  } finally {
    if (client) client.release()
  }

  const statusCode = health.status === 'ok' ? 200 : 503
  return NextResponse.json(health, { status: statusCode })
}
