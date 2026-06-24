import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const areaId = searchParams.get('area_id')
    const regionalId = searchParams.get('regional_id')

    let query = `
      SELECT n.id, n.name, n.code, n.regional_id, n.area_id, n.lat, n.lng, n.created_at,
             r.name as regional_name, a.name as area_name
      FROM master_cluster_nop n
      LEFT JOIN downstream_servers r ON r.id = n.regional_id
      LEFT JOIN master_area a ON a.id = n.area_id
      WHERE 1=1
    `
    const params: any[] = []
    let paramIndex = 1

    if (areaId) {
      query += ` AND n.area_id = $${paramIndex++}`
      params.push(parseInt(areaId))
    }
    if (regionalId) {
      query += ` AND n.regional_id = $${paramIndex++}`
      params.push(parseInt(regionalId))
    }

    query += ' ORDER BY n.name'

    const client = await pool.connect()
    const result = await client.query(query, params)
    client.release()
    return NextResponse.json(result.rows)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { name, code, regional_id, area_id } = await request.json()
    const client = await pool.connect()
    const result = await client.query(
      'INSERT INTO master_cluster_nop (name, code, regional_id, area_id) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, code, regional_id, area_id]
    )
    client.release()
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}