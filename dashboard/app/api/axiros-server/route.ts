import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { redis, ensureConnected } from '@/lib/redis'

const CACHE_KEY = 'axiros_server'
const CACHE_TTL = 3600 // 1 hour in seconds

// GET - Retrieve Axiros Server configuration
export async function GET() {
  try {
    // Try to get from Redis cache first
    await ensureConnected()
    const cached = await redis.get(CACHE_KEY)
    
    if (cached) {
      return NextResponse.json(JSON.parse(cached))
    }

    // If not in cache, fetch from database
    let client
    try {
      client = await pool.connect()
      
      const res = await client.query(
        'SELECT id, server_url, base_path, auth_username, auth_password, is_active, created_at, updated_at FROM axiros_server ORDER BY id DESC LIMIT 1'
      )
      
      if (res.rows.length === 0) {
        return NextResponse.json(null)
      }
      
      // Cache the result in Redis
      await redis.set(CACHE_KEY, JSON.stringify(res.rows[0]), { EX: CACHE_TTL })
      
      return NextResponse.json(res.rows[0])
    } finally {
      if (client) client.release()
    }
  } catch (error) {
    return NextResponse.json(null)
  }
}

// POST - Save Axiros Server configuration
export async function POST(request: Request) {
  let client
  try {
    const body = await request.json()
    const { server_url, base_path, auth_username, auth_password, is_active } = body
    
    client = await pool.connect()
    
    // Check if configuration exists
    const checkRes = await client.query('SELECT id FROM axiros_server LIMIT 1')
    
    if (checkRes.rows.length > 0) {
      // Update existing
      await client.query(
        'UPDATE axiros_server SET server_url = $1, base_path = $2, auth_username = $3, auth_password = $4, is_active = $5, updated_at = NOW() WHERE id = $6',
        [server_url, base_path, auth_username, auth_password, is_active, checkRes.rows[0].id]
      )
    } else {
      // Insert new
      await client.query(
        'INSERT INTO axiros_server (server_url, base_path, auth_username, auth_password, is_active) VALUES ($1, $2, $3, $4, $5)',
        [server_url, base_path, auth_username, auth_password, is_active]
      )
    }

    // Invalidate cache after saving configuration
    await ensureConnected()
    await redis.del(CACHE_KEY)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}
