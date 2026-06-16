import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { redis, ensureConnected } from '@/lib/redis'

const CACHE_KEY = 'manufacturer'
const CACHE_TTL = 3600 // 1 hour in seconds

// GET - Fetch all manufacturers
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
      'SELECT id, name, created_at, created_by FROM manufacturer ORDER BY created_at DESC'
    )
    client.release()
    
    // Cache the result in Redis
    await redis.set(CACHE_KEY, JSON.stringify(result.rows), { EX: CACHE_TTL })
    
    return NextResponse.json(result.rows)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch manufacturers' }, { status: 500 })
  }
}

// POST - Create a new manufacturer
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, created_by } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const client = await pool.connect()
    const result = await client.query(
      'INSERT INTO manufacturer (name, created_by) VALUES ($1, $2) RETURNING *',
      [name, created_by || null]
    )
    client.release()

    // Invalidate cache after creating new manufacturer
    await ensureConnected()
    await redis.del(CACHE_KEY)

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create manufacturer' }, { status: 500 })
  }
}

// PUT - Update a manufacturer
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, name } = body

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const client = await pool.connect()
    const result = await client.query(
      'UPDATE manufacturer SET name = $1 WHERE id = $2 RETURNING *',
      [name, id]
    )
    client.release()

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Manufacturer not found' }, { status: 404 })
    }

    // Invalidate cache after updating manufacturer
    await ensureConnected()
    await redis.del(CACHE_KEY)

    return NextResponse.json(result.rows[0])
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update manufacturer' }, { status: 500 })
  }
}

// DELETE - Delete a manufacturer
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const client = await pool.connect()
    const result = await client.query('DELETE FROM manufacturer WHERE id = $1 RETURNING *', [id])
    client.release()

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Manufacturer not found' }, { status: 404 })
    }

    // Invalidate cache after deleting manufacturer
    await ensureConnected()
    await redis.del(CACHE_KEY)

    return NextResponse.json({ message: 'Manufacturer deleted successfully' })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete manufacturer' }, { status: 500 })
  }
}
