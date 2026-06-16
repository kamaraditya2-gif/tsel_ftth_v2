import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const alarmType = searchParams.get('alarmType')
  const deviceSearch = searchParams.get('deviceSearch')
  const limit = parseInt(searchParams.get('limit') || '100')
  const offset = parseInt(searchParams.get('offset') || '0')

  try {
    const client = await pool.connect()

    let whereClause = ''
    const params: any[] = []
    let paramIdx = 1

    if (alarmType) {
      whereClause += ` AND a.alarm_type = $${paramIdx++}`
      params.push(alarmType)
    }

    if (deviceSearch) {
      whereClause += ` AND (d.device_name ILIKE $${paramIdx++} OR d.serial_number ILIKE $${paramIdx++})`
      params.push(`%${deviceSearch}%`, `%${deviceSearch}%`)
    }

    const query = `
      SELECT 
        a.id,
        a.device_id,
        a.alarm_type,
        a.metric_value,
        a.threshold_value,
        a.severity,
        a.message,
        a.triggered_at,
        a.last_checked_at,
        a.run_id,
        d.device_name,
        d.serial_number,
        d.cpe_type,
        d.status as device_status,
        EXTRACT(EPOCH FROM (NOW() - a.triggered_at))::INTEGER as duration_seconds
      FROM active_alarms a
      JOIN devices_ont d ON d.id = a.device_id
      WHERE 1=1 ${whereClause}
      ORDER BY a.triggered_at DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `
    params.push(limit, offset)

    const countQuery = `
      SELECT COUNT(*) as total
      FROM active_alarms a
      JOIN devices_ont d ON d.id = a.device_id
      WHERE 1=1 ${whereClause.replace(/LIMIT \$\d+ OFFSET \$\d+$/, '')}
    `
    const countParams = params.slice(0, -2)

    const [result, countResult] = await Promise.all([
      client.query(query, params),
      client.query(countQuery, countParams)
    ])

    client.release()

    return NextResponse.json({
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit,
        offset
      }
    })
  } catch (error: any) {
    console.error('Active alarms error:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch active alarms' }, { status: 500 })
  }
}
