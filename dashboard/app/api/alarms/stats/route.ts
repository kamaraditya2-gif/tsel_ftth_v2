import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  try {
    const client = await pool.connect()

    const result = await client.query(`
      SELECT 
        alarm_type,
        COUNT(*) as count
      FROM active_alarms
      GROUP BY alarm_type
    `)

    const totalResult = await client.query(`
      SELECT COUNT(*) as total FROM active_alarms
    `)

    client.release()

    const stats: Record<string, number> = {}
    result.rows.forEach(row => {
      stats[row.alarm_type] = parseInt(row.count)
    })

    return NextResponse.json({
      total: parseInt(totalResult.rows[0].total),
      byType: stats
    })
  } catch (error: any) {
    console.error('Alarm stats error:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch alarm stats' }, { status: 500 })
  }
}
