import { NextResponse } from 'next/server'
import pool from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET() {
  let client
  try {
    client = await pool.connect()

    // Get all downstream servers with device counts and latest ping time
    const result = await client.query(`
      WITH device_counts AS (
        SELECT downstream_server_id, COUNT(*) as cnt
        FROM devices_ont
        GROUP BY downstream_server_id
      ),
      recent_ping_counts AS (
        SELECT downstream_server_id, COUNT(*) as cnt, MAX(created_at) as last_ping
        FROM test_results_direct_ping
        WHERE created_at > NOW() - INTERVAL '30 minutes'
        GROUP BY downstream_server_id
      ),
      latest_ping AS (
        SELECT downstream_server_id, MAX(created_at) as last_ping
        FROM test_results_direct_ping
        WHERE created_at > NOW() - INTERVAL '1 hour'
        GROUP BY downstream_server_id
      )
      SELECT
        ds.id, ds.name, ds.location, ds.province, ds.status,
        ds.lat, ds.lng, ds.icon, ds.color,
        COALESCE(dc.cnt, 0) as device_count,
        lp.last_ping as last_ping_at,
        COALESCE(rpc.cnt, 0) as recent_pings
      FROM downstream_servers ds
      LEFT JOIN device_counts dc ON dc.downstream_server_id = ds.id
      LEFT JOIN latest_ping lp ON lp.downstream_server_id = ds.id
      LEFT JOIN recent_ping_counts rpc ON rpc.downstream_server_id = ds.id
      ORDER BY ds.id
    `)

    const regions = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      location: row.location,
      province: row.province,
      status: row.status,
      lat: row.lat,
      lng: row.lng,
      icon: row.icon,
      color: row.color,
      device_count: parseInt(row.device_count) || 0,
      last_ping_at: row.last_ping_at,
      is_connected: row.recent_pings > 0 || row.status === 'active',
      recent_pings: parseInt(row.recent_pings) || 0
    }))

    return NextResponse.json({
      regions,
      summary: {
        total: regions.length,
        connected: regions.filter(r => r.is_connected).length,
        total_devices: regions.reduce((s, r) => s + r.device_count, 0),
        by_status: {
          active: regions.filter(r => r.status === 'active').length,
          inactive: regions.filter(r => r.status === 'inactive').length
        }
      }
    })
  } catch (error) {
    console.error('Error fetching regional status:', error)
    return NextResponse.json({ error: 'Failed to fetch regional status' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}
