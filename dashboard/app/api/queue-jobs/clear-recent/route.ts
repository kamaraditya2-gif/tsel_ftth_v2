import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { redis, ensureConnected } from '@/lib/redis'

const QUEUES = ['acs-fast', 'acs-download', 'acs-upload', 'acs-queue']

export async function POST() {
  try {
    let deletedCount = 0

    // 1. Delete pending queue_jobs from DB (jangan hapus processing/completed/failed)
    const result = await pool.query(
      "DELETE FROM queue_jobs WHERE status = 'pending'"
    )
    deletedCount = result.rowCount || 0

    // 2. Clear BullMQ queues from Redis
    try {
      await ensureConnected()

      for (const queue of QUEUES) {
        const prefix = `bull:${queue}`

        // Hapus job keys — cari semua key dengan prefix ini
        const keys = await redis.keys(`${prefix}:*`)
        const keysToDelete: string[] = []

        for (const key of keys) {
          // Hanya hapus waiting, active, delayed, dan individual job keys
          // Biarkan completed, failed, events, stalled-check
          if (
            key.endsWith(':waiting') ||
            key.endsWith(':active') ||
            key.endsWith(':delayed') ||
            key.endsWith(':id') ||
            key.endsWith(':paused') ||
            key.endsWith(':repeat') ||
            key.match(/^bull:[^:]+:\d+$/)
          ) {
            keysToDelete.push(key)
          }
        }

        if (keysToDelete.length > 0) {
          await redis.del(keysToDelete)
        }
      }
    } catch (redisError) {
      console.error('Error clearing Redis queues:', redisError)
    }

    return NextResponse.json({
      message: 'Recent queue jobs cleared successfully',
      deletedCount
    }, { status: 200 })
  } catch (error) {
    console.error('Error clearing recent queue jobs:', error)
    return NextResponse.json({
      error: 'Failed to clear recent queue jobs'
    }, { status: 500 })
  }
}
