import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { redis, ensureConnected } from '@/lib/redis'

const CACHE_KEY = 'ont_model'
const CACHE_TTL = 3600 // 1 hour in seconds

// GET - Fetch all ONT models with manufacturer names
export async function GET() {
  try {
    // Try to get from Redis cache first
    await ensureConnected()
    const cached = await redis.get(CACHE_KEY)
    
    if (cached) {
      return NextResponse.json(JSON.parse(cached))
    }

    // If not in cache, fetch from database with manufacturer name
    const client = await pool.connect()
    const result = await client.query(
      `SELECT om.id, om.name, om.manufacturer_id, om.created_at, om.created_by, m.name as manufacturer_name
       FROM ont_model om
       LEFT JOIN manufacturer m ON om.manufacturer_id = m.id
       ORDER BY om.created_at DESC`
    )
    client.release()
    
    // Cache the result in Redis
    await redis.set(CACHE_KEY, JSON.stringify(result.rows), { EX: CACHE_TTL })
    
    return NextResponse.json(result.rows)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch ONT models' }, { status: 500 })
  }
}

// POST - Create a new ONT model
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, manufacturer_id, created_by } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const client = await pool.connect()
    const result = await client.query(
      'INSERT INTO ont_model (name, manufacturer_id, created_by) VALUES ($1, $2, $3) RETURNING *',
      [name, manufacturer_id || null, created_by || null]
    )
    client.release()

    // Invalidate cache after creating new ONT model
    await ensureConnected()
    await redis.del(CACHE_KEY)

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create ONT model' }, { status: 500 })
  }
}

// PUT - Update an ONT model
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, name, manufacturer_id } = body

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const client = await pool.connect()
    const result = await client.query(
      'UPDATE ont_model SET name = $1, manufacturer_id = $2 WHERE id = $3 RETURNING *',
      [name, manufacturer_id || null, id]
    )
    client.release()

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'ONT model not found' }, { status: 404 })
    }

    // Invalidate cache after updating ONT model
    await ensureConnected()
    await redis.del(CACHE_KEY)

    return NextResponse.json(result.rows[0])
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update ONT model' }, { status: 500 })
  }
}

// DELETE - Delete an ONT model
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const client = await pool.connect()
    const result = await client.query('DELETE FROM ont_model WHERE id = $1 RETURNING *', [id])
    client.release()

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'ONT model not found' }, { status: 404 })
    }

    // Invalidate cache after deleting ONT model
    await ensureConnected()
    await redis.del(CACHE_KEY)

    return NextResponse.json({ message: 'ONT model deleted successfully' })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete ONT model' }, { status: 500 })
  }
}
