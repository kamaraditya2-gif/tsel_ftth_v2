import { NextResponse } from 'next/server'
import pool from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get('device_id')

    if (!deviceId) {
      return NextResponse.json({ error: 'device_id is required' }, { status: 400 })
    }

    const client = await pool.connect()

    const [activeRes, historyRes] = await Promise.all([
      client.query(`
        SELECT alarm_type, metric_value, threshold_value, severity, 'active' as source,
               triggered_at, NULL as cleared_at,
               EXTRACT(EPOCH FROM (NOW() - triggered_at))::INTEGER as duration_seconds
        FROM active_alarms
        WHERE device_id = $1
        ORDER BY severity, alarm_type
      `, [parseInt(deviceId)]),
      client.query(`
        SELECT alarm_type, metric_value, threshold_value, severity, 'history' as source,
               triggered_at, cleared_at, duration_seconds
        FROM alarm_history
        WHERE device_id = $1 AND triggered_at >= NOW() - INTERVAL '3 months'
        ORDER BY triggered_at DESC
        LIMIT 100
      `, [parseInt(deviceId)]).catch(() => ({ rows: [] }))
    ])

    client.release()

    const all = [...historyRes.rows, ...activeRes.rows]
    return NextResponse.json({ results: all })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
