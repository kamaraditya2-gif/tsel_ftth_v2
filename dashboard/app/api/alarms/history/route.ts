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

    const alarmMap: Record<string, string> = {
      packet_loss: 'Packet_Loss', latency: 'Latency', download: 'Download_Speed',
      upload: 'Upload_Speed', jitter: 'Jitter', crc_error: 'CRC_Error',
      high_temp: 'Temperature', cpu: 'CPU_Utilization', memory: 'Memory_Utilization',
      ping_success: 'Ping_Success_Rate', uptime: 'Uptime',
    }
    const recalcSeverity = (alarmType: string, metricValue: number) => {
      const key = alarmMap[alarmType] || alarmType
      const th = thresholds[key]
      if (!th) return 'warning'
      const crit = Number(th.critical_value)
      const warn = Number(th.warning_value)
      if (th.threshold_type === 'UPPER') {
        if (metricValue >= crit) return 'critical'
        if (metricValue >= warn) return 'warning'
      } else {
        if (metricValue <= crit) return 'critical'
        if (metricValue <= warn) return 'warning'
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
