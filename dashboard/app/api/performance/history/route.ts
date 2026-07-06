import { NextResponse } from 'next/server'
import pool from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get('device_id')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (!deviceId) {
      return NextResponse.json({ error: 'device_id is required' }, { status: 400 })
    }

    const client = await pool.connect()

    const [pingRes, dlRes, ulRes] = await Promise.all([
      client.query(`
        SELECT executed_at as ts, 'ping' as type,
          jsonb_build_object('ping_igw', ping_igw, 'ping_ebr', ping_ebr, 'packet_loss_igw', packet_loss_igw) as data
        FROM test_results_ping
        WHERE device_id = $1 AND executed_at >= NOW() - INTERVAL '3 months'
        ORDER BY executed_at DESC
        LIMIT $2
      `, [deviceId, limit]),
      client.query(`
        SELECT executed_at as ts, 'download' as type,
          jsonb_build_object('download_speed', download_speed) as data
        FROM test_results_speed_download
        WHERE device_id = $1 AND executed_at >= NOW() - INTERVAL '3 months'
        ORDER BY executed_at DESC
        LIMIT $2
      `, [deviceId, limit]),
      client.query(`
        SELECT executed_at as ts, 'upload' as type,
          jsonb_build_object('upload_speed', upload_speed) as data
        FROM test_results_speed_upload
        WHERE device_id = $1 AND executed_at >= NOW() - INTERVAL '3 months'
        ORDER BY executed_at DESC
        LIMIT $2
      `, [deviceId, limit]),
    ])

    client.release()

    const all = [...pingRes.rows, ...dlRes.rows, ...ulRes.rows]
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
      .slice(0, limit)

    return NextResponse.json({ results: all })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
