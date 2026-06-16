import { NextResponse } from 'next/server'
import { redis, ensureConnected } from '@/lib/redis'

export async function GET(request: Request) {
  try {
    await ensureConnected()
    
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = (page - 1) * limit
    
    const allKeys = await redis.keys('*')
    const totalKeys = allKeys.length
    const totalPages = Math.ceil(totalKeys / limit)
    
    // Get paginated keys
    const paginatedKeys = allKeys.slice(offset, offset + limit)
    const keysWithInfo = []

    for (const key of paginatedKeys) {
      const type = await redis.type(key)
      const ttl = await redis.ttl(key)
      keysWithInfo.push({
        key,
        type,
        ttl,
      })
    }

    return NextResponse.json({ 
      keys: keysWithInfo,
      pagination: {
        page,
        limit,
        total: totalKeys,
        totalPages
      }
    })
  } catch (error) {
    console.error('Redis keys error:', error)
    return NextResponse.json({ error: 'Failed to fetch keys' }, { status: 500 })
  }
}
