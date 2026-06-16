import { NextResponse } from 'next/server'
import { redis, ensureConnected } from '@/lib/redis'

export async function POST() {
  try {
    await ensureConnected()
    
    // Try FLUSHDB first, if it fails (restricted Redis), delete keys individually
    try {
      await redis.flushDb()
      return NextResponse.json({ success: true, method: 'flushdb' })
    } catch (error: any) {
      if (error.message.includes('unknown command') || error.message.includes('FLUSHDB')) {
        // FLUSHDB not supported, delete keys individually
        const keys = await redis.keys('*')
        if (keys.length > 0) {
          await redis.del(keys)
        }
        return NextResponse.json({ success: true, method: 'delete-keys', count: keys.length })
      }
      throw error
    }
  } catch (error) {
    console.error('Redis flush error:', error)
    return NextResponse.json({ error: 'Failed to flush database' }, { status: 500 })
  }
}
