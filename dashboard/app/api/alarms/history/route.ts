import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const alarmType = searchParams.get('alarmType')
  const deviceSearch = searchParams.get('deviceSearch')
  const timeRange = searchParams.get('timeRange') || '24h'
  const limit = parseInt(searchParams.get('limit') || '25')
  const offset = parseInt(searchParams.get('offset') || '0')

  let interval: string
  switch (timeRange) {
    case '1h': interval = '1 hour'; break
    case '6h': interval = '6 hours'; break
    case '7d': interval = '7 days'; break
    case '30d': interval = '30 days'; break
    case '24h':
    default: interval = '24 hours'; break
  }

  try {
    const client = await pool.connect()

    let whereClause = ` AND h.cleared_at >= NOW() - INTERVAL '${interval}'`
    const params: any[] = []
    let paramIdx = 1

    if (alarmType) {
      whereClause += ` AND h.alarm_type = $${paramIdx++}`
      params.push(alarmType)
    }

    if (deviceSearch) {
      whereClause += ` AND (d.device_name ILIKE $${paramIdx++} OR d.serial_number ILIKE $${paramIdx++})`
      params.push(`%${deviceSearch}%`, `%${deviceSearch}%`)
    }

    const query = `
      SELECT 
        h.id,
        h.device_id,
        h.alarm_type,
        h.metric_value,
        h.threshold_value,
        h.severity,
        h.message,
        h.triggered_at,
        h.cleared_at,
        h.cleared_value,
        h.duration_seconds,
        h.run_id,
        d.device_name,
        d.serial_number,
        d.cpe_type
      FROM alarm_history h
      JOIN devices_ont d ON d.id = h.device_id
      WHERE 1=1 ${whereClause}
      ORDER BY h.cleared_at DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `
    params.push(limit, offset)

    const countQuery = `
      SELECT COUNT(*) as total
      FROM alarm_history h
      JOIN devices_ont d ON d.id = h.device_id
      WHERE 1=1 ${whereClause}
    `

    const [result, countResult] = await Promise.all([
      client.query(query, params),
      client.query(countQuery, params.slice(0, -2))
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
    console.error('Alarm history error:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch alarm history' }, { status: 500 })
  }
}
