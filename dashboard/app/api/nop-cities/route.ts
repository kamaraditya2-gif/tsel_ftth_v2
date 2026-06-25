import { NextResponse } from 'next/server'
import pool from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const client = await pool.connect()
    const result = await client.query(
      'SELECT id, name, regional_id FROM master_cluster_nop ORDER BY id'
    )
    client.release()
    return NextResponse.json({ cities: result.rows.map(r => ({ id: r.id, city: r.name, region_id: r.regional_id })) })
  } catch {
    return NextResponse.json({ cities: [] })
  }
}