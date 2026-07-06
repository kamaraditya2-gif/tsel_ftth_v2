import { NextResponse } from 'next/server'
import pool from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const client = await pool.connect()
    const result = await client.query(`
      SELECT
        COUNT(*) as total_resolved,
        ROUND(AVG(duration_seconds))::INTEGER as avg_duration_seconds,
        MAX(duration_seconds) as max_duration_seconds,
        MIN(duration_seconds) as min_duration_seconds
      FROM alarm_history
      WHERE cleared_at >= NOW() - INTERVAL '30 days'
    `)
    client.release()
    return NextResponse.json(result.rows[0] || { total_resolved: 0, avg_duration_seconds: 0 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
