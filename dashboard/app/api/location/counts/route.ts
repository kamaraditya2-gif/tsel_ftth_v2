import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const client = await pool.connect()
    const result = await client.query(`
      SELECT a.id as area_id, a.name as area_name,
        n.regional_id, COALESCE(r.name, 'R' || n.regional_id) as regional_name,
        n.id as nop_id, n.name as nop_name,
        COUNT(d.id) as device_count
      FROM master_area a
      JOIN master_cluster_nop n ON n.area_id = a.id
      LEFT JOIN downstream_servers r ON r.id = n.regional_id
      LEFT JOIN devices_ont d ON d.cluster_nop_id = n.id
      GROUP BY a.id, a.name, n.regional_id, r.name, n.id, n.name
      ORDER BY a.name, n.regional_id, n.name
    `)
    client.release()
    return NextResponse.json({ data: result.rows })
  } catch (error: any) {
    console.error('Location counts error:', error.message)
    return NextResponse.json({ data: [] })
  }
}