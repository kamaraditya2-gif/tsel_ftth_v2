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

    // Fetch current thresholds for severity recalculation
    const threshRes = await client.query(`
      SELECT alarm_name, threshold_type, warning_value, critical_value
      FROM threshold_master WHERE status = 'active'
    `)
    const thresholds: Record<string, any> = {}
    for (const t of threshRes.rows) {
      thresholds[t.alarm_name] = t
    }

    const recalcSeverity = (alarmType: string, metricValue: number) => {
      const th = thresholds[alarmType]
      if (!th) return 'warning' // keep default if no threshold config
      if (th.threshold_type === 'UPPER') {
        if (metricValue >= Number(th.critical_value)) return 'critical'
        if (metricValue >= Number(th.warning_value)) return 'warning'
      } else {
        if (metricValue <= Number(th.critical_value)) return 'critical'
        if (metricValue <= Number(th.warning_value)) return 'warning'
      }
      return 'warning'
    }

    const [activeRes, historyRes] = await Promise.all([
      client.query(`
        SELECT alarm_type, metric_value, threshold_value, severity, 'active' as source, NOW() as triggered_at
        FROM active_alarms
        WHERE device_id = $1
        ORDER BY severity, alarm_type
      `, [parseInt(deviceId)]),
      client.query(`
        SELECT alarm_type, metric_value, threshold_value, severity, 'history' as source, triggered_at
        FROM alarm_history
        WHERE device_id = $1 AND triggered_at >= NOW() - INTERVAL '3 months'
        ORDER BY triggered_at DESC
        LIMIT 100
      `, [parseInt(deviceId)]).catch(() => ({ rows: [] }))
    ])

    client.release()

    const all = [...historyRes.rows, ...activeRes.rows].map((r: any) => ({
      ...r,
      severity: recalcSeverity(r.alarm_type, Number(r.metric_value)),
    }))
    return NextResponse.json({ results: all })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
