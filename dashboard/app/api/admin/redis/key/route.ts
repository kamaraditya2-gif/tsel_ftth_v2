import { NextResponse } from 'next/server'
import { redis, ensureConnected } from '@/lib/redis'

export async function GET(request: Request) {
  try {
    await ensureConnected()
    
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    
    if (!key) {
      return NextResponse.json({ error: 'Key is required' }, { status: 400 })
    }

    const type = await redis.type(key)
    let value: any

    switch (type) {
      case 'string':
        value = await redis.get(key)
        break
      case 'list':
        value = await redis.lRange(key, 0, -1)
        break
      case 'set':
        value = await redis.sMembers(key)
        break
      case 'zset':
        value = await redis.zRange(key, 0, -1)
        break
      case 'hash':
        value = await redis.hGetAll(key)
        break
      default:
        value = await redis.get(key)
    }

    return NextResponse.json({ value, type })
  } catch (error) {
    console.error('Redis key error:', error)
    return NextResponse.json({ error: 'Failed to fetch key value' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureConnected()
    
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    
    if (!key) {
      return NextResponse.json({ error: 'Key is required' }, { status: 400 })
    }

    await redis.del(key)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Redis delete key error:', error)
    return NextResponse.json({ error: 'Failed to delete key' }, { status: 500 })
  }
}
