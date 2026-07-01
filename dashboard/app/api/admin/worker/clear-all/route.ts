import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { redis, ensureConnected } from '@/lib/redis'

const QUEUES = ['acs-fast', 'acs-download', 'acs-upload', 'acs-queue']

export async function POST() {
  try {
    // 1. Hapus semua queue_jobs dari PostgreSQL
    const dbResult = await pool.query('DELETE FROM queue_jobs')
    const dbDeleted = dbResult.rowCount || 0

    // 2. Hapus semua BullMQ keys dari Redis
    let redisDeleted = 0
    try {
      await ensureConnected()

      for (const queue of QUEUES) {
        const prefix = `bull:${queue}`
        const keys = await redis.keys(`${prefix}:*`)
        const jobKeys = await redis.keys(`bull:${queue}:`)
        const allKeys = [...keys, ...jobKeys]

        if (allKeys.length > 0) {
          await redis.del(allKeys)
          redisDeleted += allKeys.length
        }
      }
    } catch (redisError) {
      console.error('Error clearing Redis queues:', redisError)
    }

    // 3. Set stop signal — workers akan cek ini dan mati
    try {
      await ensureConnected()
      await redis.set('worker:stop-signal', Date.now().toString())
    } catch (redisError) {
      console.error('Error setting stop signal:', redisError)
    }

    return NextResponse.json({
      success: true,
      message: 'All queues cleared, workers will stop after current job',
      dbDeleted,
      redisDeleted
    })
  } catch (error: any) {
    console.error('Error clearing all workers:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to clear all workers'
    }, { status: 500 })
  }
}
