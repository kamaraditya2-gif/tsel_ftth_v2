import { NextResponse } from 'next/server'
import pool from '@/lib/db'
// GET - Retrieve all group devices with device count
export async function GET() {
  let client
  try {
    client = await pool.connect()
    
    const res = await client.query(`
      SELECT gd.id, gd.name, gd.code, gd.description, gd.created_at, gd.updated_at,
             COUNT(d.id) as device_count
      FROM group_devices gd
      LEFT JOIN devices_ont d ON gd.id = d.group_id
      GROUP BY gd.id, gd.name, gd.code, gd.description, gd.created_at, gd.updated_at
      ORDER BY gd.id ASC
    `)
    
    return NextResponse.json(res.rows)
  } catch (error) {
    console.error('Group Devices API error:', error)
    return NextResponse.json({ error: 'Failed to fetch group devices' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}

// POST - Create new group device
export async function POST(request: Request) {
  let client
  try {
    const body = await request.json()
    const { name, code, description } = body
    
    client = await pool.connect()
    
    const res = await client.query(
      'INSERT INTO group_devices (name, code, description) VALUES ($1, $2, $3) RETURNING id, name, code, description',
      [name, code, description]
    )
    
    return NextResponse.json(res.rows[0])
  } catch (error) {
    console.error('Group Devices API error:', error)
    return NextResponse.json({ error: 'Failed to create group device' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}
