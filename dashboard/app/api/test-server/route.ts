import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { redis, ensureConnected } from '@/lib/redis'

const CACHE_KEY = 'test_server'
const CACHE_TTL = 3600 // 1 hour in seconds

// GET - Fetch all test servers
export async function GET() {
  try {
    // Try to get from Redis cache first
    await ensureConnected()
    const cached = await redis.get(CACHE_KEY)
    
    if (cached) {
      return NextResponse.json(JSON.parse(cached))
    }

    // If not in cache, fetch from database
    const client = await pool.connect()
    const result = await client.query(
      'SELECT id, name, ip_address, test_type, is_active, created_at, created_by FROM test_server ORDER BY created_at DESC'
    )
    client.release()
    
    // Cache the result in Redis
    await redis.set(CACHE_KEY, JSON.stringify(result.rows), { EX: CACHE_TTL })
    
    return NextResponse.json(result.rows)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch test servers' }, { status: 500 })
  }
}

// POST - Create a new test server
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, ip_address, test_type, is_active, created_by } = body

    if (!name || !ip_address) {
      return NextResponse.json({ error: 'Name and IP address are required' }, { status: 400 })
    }

    const client = await pool.connect()
    const result = await client.query(
      'INSERT INTO test_server (name, ip_address, test_type, is_active, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, ip_address, test_type || 'igw', is_active !== undefined ? is_active : true, created_by || null]
    )
    client.release()

    // Invalidate cache after creating new server
    await ensureConnected()
    await redis.del(CACHE_KEY)

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create test server' }, { status: 500 })
  }
}

// PUT - Update a test server
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, name, ip_address, test_type, is_active } = body

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const client = await pool.connect()
    const result = await client.query(
      'UPDATE test_server SET name = $1, ip_address = $2, test_type = $3, is_active = $4 WHERE id = $5 RETURNING *',
      [name, ip_address, test_type, is_active, id]
    )
    client.release()

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Test server not found' }, { status: 404 })
    }

    // Invalidate cache after updating server
    await ensureConnected()
    await redis.del(CACHE_KEY)

    return NextResponse.json(result.rows[0])
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update test server' }, { status: 500 })
  }
}

// DELETE - Delete a test server
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const client = await pool.connect()
    const result = await client.query('DELETE FROM test_server WHERE id = $1 RETURNING *', [id])
    client.release()

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Test server not found' }, { status: 404 })
    }

    // Invalidate cache after deleting server
    await ensureConnected()
    await redis.del(CACHE_KEY)

    return NextResponse.json({ message: 'Test server deleted successfully' })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete test server' }, { status: 500 })
  }
}
