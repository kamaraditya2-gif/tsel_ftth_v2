import { NextResponse } from 'next/server'
import { redis, ensureConnected } from '@/lib/redis'

export async function GET() {
  try {
    await ensureConnected()
    
    const info = await redis.info()
    const infoLines = info.split('\r\n')
    const parsedInfo: any = {}

    for (const line of infoLines) {
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split(':')
        if (key && valueParts.length > 0) {
          parsedInfo[key] = valueParts.join(':')
        }
      }
    }

    // Get total keys count
    const dbSize = await redis.dbSize()

    return NextResponse.json({
      connected: true,
      version: parsedInfo.redis_version,
      uptime: parseInt(parsedInfo.uptime_in_seconds) || 0,
      connected_clients: parseInt(parsedInfo.connected_clients) || 0,
      used_memory: parsedInfo.used_memory,
      used_memory_human: parsedInfo.used_memory_human,
      used_memory_peak: parsedInfo.used_memory_peak,
      used_memory_peak_human: parsedInfo.used_memory_peak_human,
      total_system_memory: parsedInfo.total_system_memory,
      total_system_memory_human: parsedInfo.total_system_memory_human,
      maxmemory: parsedInfo.maxmemory,
      maxmemory_human: parsedInfo.maxmemory_human,
      keyspace_hits: parseInt(parsedInfo.keyspace_hits) || 0,
      keyspace_misses: parseInt(parsedInfo.keyspace_misses) || 0,
      total_commands_processed: parseInt(parsedInfo.total_commands_processed) || 0,
      instantaneous_ops_per_sec: parseInt(parsedInfo.instantaneous_ops_per_sec) || 0,
      total_keys: dbSize,
      db_size: dbSize,
    })
  } catch (error) {
    console.error('Redis info error:', error)
    return NextResponse.json({
      connected: false,
      error: 'Failed to connect to Redis server',
    }, { status: 500 })
  }
}
