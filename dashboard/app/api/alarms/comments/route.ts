import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const deviceId = searchParams.get('device_id')

  if (!deviceId) {
    return NextResponse.json({ error: 'device_id query parameter is required' }, { status: 400 })
  }

  try {
    const client = await pool.connect()
    const result = await client.query(
      `SELECT c.id, c.device_id, c.parent_id, c.comment, c.created_by, c.created_at
       FROM alarm_comments c
       WHERE c.device_id = $1
       ORDER BY c.created_at ASC`,
      [deviceId]
    )
    client.release()
    return NextResponse.json({ data: result.rows })
  } catch (error: any) {
    console.error('Comments GET error:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch comments' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { device_id, comment, parent_id } = body

    if (!device_id || !comment) {
      return NextResponse.json({ error: 'device_id and comment are required' }, { status: 400 })
    }

    const client = await pool.connect()
    const result = await client.query(
      `INSERT INTO alarm_comments (device_id, comment, parent_id, created_by, created_at)
       VALUES ($1, $2, $3, 'admin', NOW())
       RETURNING id, device_id, parent_id, comment, created_by, created_at`,
      [device_id, comment, parent_id || null]
    )
    client.release()

    return NextResponse.json({ data: result.rows[0] }, { status: 201 })
  } catch (error: any) {
    console.error('Comments POST error:', error)
    return NextResponse.json({ error: error.message || 'Failed to create comment' }, { status: 500 })
  }
}
