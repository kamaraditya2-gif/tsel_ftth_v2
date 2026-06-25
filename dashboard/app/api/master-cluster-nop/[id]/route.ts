import { NextResponse } from 'next/server'
import pool from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const client = await pool.connect()
    const result = await client.query(
      'SELECT n.id, n.name, n.code, n.regional_id, n.area_id, n.lat, n.lng, n.created_at, r.name as regional_name, a.name as area_name FROM master_cluster_nop n LEFT JOIN downstream_servers r ON r.id = n.regional_id LEFT JOIN master_area a ON a.id = n.area_id WHERE n.id = $1',
      [params.id]
    )
    client.release()
    if (result.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(result.rows[0])
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const { name, code, regional_id, area_id, lat, lng } = await request.json()
    const client = await pool.connect()
    const result = await client.query(
      'UPDATE master_cluster_nop SET name = $1, code = $2, regional_id = $3, area_id = $4, lat = $5, lng = $6 WHERE id = $7 RETURNING id, name, code, regional_id, area_id, lat, lng, created_at',
      [name, code, regional_id, area_id, lat, lng, params.id]
    )
    client.release()
    if (result.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(result.rows[0])
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const client = await pool.connect()
    await client.query('DELETE FROM master_cluster_nop WHERE id = $1', [params.id])
    client.release()
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}