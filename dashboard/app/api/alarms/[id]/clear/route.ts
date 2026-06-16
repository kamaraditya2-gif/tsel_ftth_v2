import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const alarmId = parseInt(params.id)
  if (isNaN(alarmId)) {
    return NextResponse.json({ error: 'Invalid alarm ID' }, { status: 400 })
  }

  try {
    const client = await pool.connect()

    // Get active alarm
    const alarmResult = await client.query(
      'SELECT * FROM active_alarms WHERE id = $1',
      [alarmId]
    )

    if (alarmResult.rows.length === 0) {
      client.release()
      return NextResponse.json({ error: 'Alarm not found' }, { status: 404 })
    }

    const alarm = alarmResult.rows[0]
    const duration = Math.floor((new Date().getTime() - new Date(alarm.triggered_at).getTime()) / 1000)

    // Move to history
    await client.query(
      `INSERT INTO alarm_history 
       (device_id, alarm_type, metric_value, threshold_value, severity, message, triggered_at, cleared_at, cleared_value, run_id, duration_seconds)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10)`,
      [
        alarm.device_id, alarm.alarm_type, alarm.metric_value, alarm.threshold_value,
        alarm.severity, alarm.message || 'Manually cleared', alarm.triggered_at,
        alarm.metric_value, alarm.run_id, duration
      ]
    )

    // Delete from active
    await client.query('DELETE FROM active_alarms WHERE id = $1', [alarmId])

    client.release()

    return NextResponse.json({ success: true, message: 'Alarm cleared' })
  } catch (error: any) {
    console.error('Clear alarm error:', error)
    return NextResponse.json({ error: error.message || 'Failed to clear alarm' }, { status: 500 })
  }
}
