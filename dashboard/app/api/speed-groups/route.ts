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
function calcThresholds(speedLimit: number | null, profile: string | null) {
  if (!speedLimit || !profile) return { download_threshold: null, upload_threshold: null }
  const pct: Record<string, { dl: number; ul: number }> = {
    Bronze: { dl: 20, ul: 10 }, Silver: { dl: 40, ul: 20 },
    Gold: { dl: 60, ul: 30 }, Platinum: { dl: 80, ul: 40 }
  }
  const p = pct[profile]
  if (!p) return { download_threshold: null, upload_threshold: null }
  return { download_threshold: speedLimit * p.dl / 100, upload_threshold: speedLimit * p.ul / 100 }
}

export async function POST(request: Request) {
  let client
  try {
    const body = await request.json()
    const { name, speed_limit, profile, description } = body
    const { download_threshold, upload_threshold } = calcThresholds(speed_limit, profile)
    
    client = await pool.connect()
    
    const res = await client.query(
      'INSERT INTO speed_group (name, speed_limit, profile, download_threshold, upload_threshold, description) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, speed_limit, profile, download_threshold, upload_threshold, description',
      [name, speed_limit, profile, download_threshold, upload_threshold, description]
    )
    
    return NextResponse.json(res.rows[0])
  } catch (error) {
    console.error('Speed Groups API error:', error)
    return NextResponse.json({ error: 'Failed to create speed group' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}
