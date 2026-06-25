import { NextResponse } from 'next/server'
import pool from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  let client
  try {
    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('timeRange') || '24h'
    const dataSource = searchParams.get('dataSource') || 'upstream'
    const areaId = searchParams.get('areaId')
    const regionalId = searchParams.get('regionalId')
    const nopId = searchParams.get('nopId')
    const speedGroupId = searchParams.get('speedGroupId')
    const manufacturerId = searchParams.get('manufacturerId')
    const ontModelId = searchParams.get('ontModelId')

    const intervalMap: Record<string, string> = {
      '1h': '1 hour',
      '6h': '6 hours',
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days'
    }
    const interval = intervalMap[timeRange] || '24 hours'

    // Build WHERE clause for regional and speed filters
    const filterConditions: string[] = []
    const filterParams: any[] = []
    let paramIndex = 1

    if (areaId) {
      filterConditions.push(`d.cluster_nop_id IN (SELECT id FROM master_cluster_nop WHERE area_id = $${paramIndex})`)
      filterParams.push(parseInt(areaId))
      paramIndex++
    }

    if (regionalId) {
      filterConditions.push(`d.downstream_server_id = $${paramIndex}`)
      filterParams.push(parseInt(regionalId))
      paramIndex++
    }

    if (nopId) {
      filterConditions.push(`d.cluster_nop_id = $${paramIndex}`)
      filterParams.push(parseInt(nopId))
      paramIndex++
    }

    if (speedGroupId) {
      filterConditions.push(`d.speed_id = $${paramIndex}`)
      filterParams.push(parseInt(speedGroupId))
      paramIndex++
    }

    if (manufacturerId) {
      filterConditions.push(`d.manufacturer = (SELECT name FROM manufacturer WHERE id = $${paramIndex})`)
      filterParams.push(parseInt(manufacturerId))
      paramIndex++
    }

    if (ontModelId) {
      filterConditions.push(`d.model = (SELECT name FROM ont_model WHERE id = $${paramIndex})`)
      filterParams.push(parseInt(ontModelId))
      paramIndex++
    }

    const whereClause = filterConditions.length > 0 ? `AND ${filterConditions.join(' AND ')}` : ''

    client = await pool.connect()

    // Query devices_ont with lat/lng and latest status
    let query = ''

    if (dataSource === 'downstream') {
      const serverIdParam = searchParams.get('serverId') || '1'
      const serverFilter = `AND d.downstream_server_id = ${parseInt(serverIdParam)}`
      // Query with downstream data from test_results_direct_ping
      query = `
        SELECT
          d.id,
          d.serial_number,
          d.indihome_id,
          d.status,
          d.last_seen,
          d.lat,
          d.lng,
          ds.name as regional_name,
          sg.name as speed_name,
          sg.download_threshold,
          sg.upload_threshold,
          NULL as ping_igw,
          NULL as download_speed,
          NULL as upload_speed,
          -- Latest direct ping data
          (
            SELECT avg_latency_ms
            FROM test_results_direct_ping
            WHERE device_id = d.id
            AND created_at >= NOW() - INTERVAL '${interval}'
            ORDER BY created_at DESC
            LIMIT 1
          ) as avg_latency_ms,
          (
            SELECT packet_loss_percent
            FROM test_results_direct_ping
            WHERE device_id = d.id
            AND created_at >= NOW() - INTERVAL '${interval}'
            ORDER BY created_at DESC
            LIMIT 1
          ) as packet_loss_percent
        FROM devices_ont d
        LEFT JOIN downstream_servers ds ON d.downstream_server_id = ds.id
        LEFT JOIN speed_group sg ON d.speed_id = sg.id
        WHERE d.lat IS NOT NULL
          AND d.lng IS NOT NULL
          ${serverFilter}
          ${whereClause}
        ORDER BY d.id
      `
    } else {
      // Query with upstream data (existing query)
      query = `
        SELECT
          d.id,
          d.serial_number,
          d.indihome_id,
          d.status,
          d.last_seen,
          d.lat,
          d.lng,
          ds.name as regional_name,
          sg.name as speed_name,
          sg.download_threshold,
          sg.upload_threshold,
          -- Latest ping data for intensity
          (
            SELECT ping_igw
            FROM test_results_ping
            WHERE device_id = d.id
            AND executed_at >= NOW() - INTERVAL '${interval}'
            ORDER BY executed_at DESC
            LIMIT 1
          ) as ping_igw,
          (
            SELECT download_speed
            FROM test_results_speed_download
            WHERE device_id = d.id
            AND executed_at >= NOW() - INTERVAL '${interval}'
            ORDER BY executed_at DESC
            LIMIT 1
          ) as download_speed,
          (
            SELECT upload_speed
            FROM test_results_speed_upload
            WHERE device_id = d.id
            AND executed_at >= NOW() - INTERVAL '${interval}'
            ORDER BY executed_at DESC
            LIMIT 1
          ) as upload_speed,
          NULL as avg_latency_ms,
          NULL as packet_loss_percent
        FROM devices_ont d
        LEFT JOIN downstream_servers ds ON d.downstream_server_id = ds.id
        LEFT JOIN speed_group sg ON d.speed_id = sg.id
        WHERE d.lat IS NOT NULL
          AND d.lng IS NOT NULL
          ${whereClause}
        ORDER BY d.id
      `
    }

    const result = await client.query(query, filterParams)

    // Fetch downstream servers for map visualization
    const serversRes = await client.query(
      `SELECT id, name, location, province, lat, lng, status, icon, color
       FROM downstream_servers
       ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, province`
    )

    return NextResponse.json({
      devices: result.rows,
      count: result.rows.length,
      servers: serversRes.rows
    })
  } catch (error) {
    console.error('Error fetching device map data:', error)
    return NextResponse.json(
      { devices: [], count: 0, error: 'Failed to fetch device map data' },
      { status: 200 }
    )
  } finally {
    if (client) client.release()
  }
}
