import { NextResponse } from 'next/server'
import pool from '@/lib/db'
// GET - Retrieve all speed groups
export async function GET() {
  let client
  try {
    client = await pool.connect()
    
    const res = await client.query(`
      SELECT sg.id, sg.name, sg.speed_limit, sg.profile, sg.description, sg.created_at, sg.updated_at,
             COUNT(d.id) as device_count
      FROM speed_group sg
      LEFT JOIN devices_ont d ON sg.id = d.speed_id
      GROUP BY sg.id, sg.name, sg.speed_limit, sg.profile, sg.description, sg.created_at, sg.updated_at
      ORDER BY sg.speed_limit ASC NULLS LAST
    `)
    
    return NextResponse.json(res.rows)
  } catch (error) {
    console.error('Speed Groups API error:', error)
    return NextResponse.json({ error: 'Failed to fetch speed groups' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}

// POST - Create new speed group
export async function POST(request: Request) {
  let client
  try {
    const body = await request.json()
    const { name, speed_limit, profile, description } = body
    
    client = await pool.connect()
    
    const res = await client.query(
      'INSERT INTO speed_group (name, speed_limit, profile, description) VALUES ($1, $2, $3, $4) RETURNING id, name, speed_limit, profile, description',
      [name, speed_limit, profile, description]
    )
    
    return NextResponse.json(res.rows[0])
  } catch (error) {
    console.error('Speed Groups API error:', error)
    return NextResponse.json({ error: 'Failed to create speed group' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}
