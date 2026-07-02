import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { parseIds, buildOptionalFilter } from '@/lib/filter-utils'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const timeRange = searchParams.get('timeRange') || '24h'
  const areaId = searchParams.get('areaId')
  const regionalId = searchParams.get('regionalId')
  const nopId = searchParams.get('nopId')

  let interval: string
  switch (timeRange) {
    case '1h': interval = '1 hour'; break
    case '6h': interval = '6 hours'; break
    case '7d': interval = '7 days'; break
    case '30d': interval = '30 days'; break
    case '24h':
    default: interval = '24 hours'; break
  }

  const filterWhere = []
  const filterParams: any[] = []
  let pIdx = 1
  const areaIdFilter = buildOptionalFilter('n.area_id', areaId, searchParams.get('areaIds'), () => pIdx++, filterParams)
  if (areaIdFilter) filterWhere.push(areaIdFilter)

  const regionalIdFilter = buildOptionalFilter('d.downstream_server_id', regionalId, searchParams.get('regionalIds'), () => pIdx++, filterParams)
  if (regionalIdFilter) filterWhere.push(regionalIdFilter)

  const nopIdFilter = buildOptionalFilter('d.cluster_nop_id', nopId, searchParams.get('nopIds'), () => pIdx++, filterParams)
  if (nopIdFilter) filterWhere.push(nopIdFilter)
  const filterSQL = filterWhere.length > 0 ? 'AND ' + filterWhere.join(' AND ') : ''

  try {
    const client = await pool.connect()

    const result = await client.query(`
      WITH 
      device_filter AS (
        SELECT d.id FROM devices_ont d
        LEFT JOIN master_cluster_nop n ON n.id = d.cluster_nop_id
        WHERE d.cpe_type IS NOT NULL AND d.cpe_type != ''
        ${filterSQL}
      ),
      download_stats AS (
        SELECT 
          d.cpe_type,
          ROUND(AVG(t.download_speed)::numeric, 2) as avg_download,
          COUNT(*) as download_tests
        FROM devices_ont d
        JOIN test_results_speed_download t ON t.device_id = d.id
        WHERE t.executed_at >= NOW() - INTERVAL '${interval}'
          AND d.cpe_type IS NOT NULL AND d.cpe_type != ''
          AND d.id IN (SELECT id FROM device_filter)
        GROUP BY d.cpe_type
      ),
      upload_stats AS (
        SELECT 
          d.cpe_type,
          ROUND(AVG(t.upload_speed)::numeric, 2) as avg_upload,
          COUNT(*) as upload_tests
        FROM devices_ont d
        JOIN test_results_speed_upload t ON t.device_id = d.id
        WHERE t.executed_at >= NOW() - INTERVAL '${interval}'
          AND d.cpe_type IS NOT NULL AND d.cpe_type != ''
          AND d.id IN (SELECT id FROM device_filter)
        GROUP BY d.cpe_type
      ),
      ping_stats AS (
        SELECT 
          d.cpe_type,
          ROUND(AVG(t.ping_igw)::numeric, 2) as avg_igw_latency,
          ROUND(AVG(t.ping_ebr)::numeric, 2) as avg_ebr_latency,
          COUNT(*) as ping_tests
        FROM devices_ont d
        JOIN test_results_ping t ON t.device_id = d.id
        WHERE t.executed_at >= NOW() - INTERVAL '${interval}'
          AND d.cpe_type IS NOT NULL AND d.cpe_type != ''
          AND d.id IN (SELECT id FROM device_filter)
        GROUP BY d.cpe_type
      ),
      packet_loss_stats AS (
        SELECT 
          d.cpe_type,
          ROUND(AVG(t.packet_loss_igw)::numeric, 2) as avg_packet_loss_igw,
          ROUND(AVG(t.packet_loss_ebr)::numeric, 2) as avg_packet_loss_ebr,
          COUNT(*) as packet_loss_tests
        FROM devices_ont d
        JOIN test_results_ping t ON t.device_id = d.id
        WHERE t.executed_at >= NOW() - INTERVAL '${interval}'
          AND d.cpe_type IS NOT NULL AND d.cpe_type != ''
          AND d.id IN (SELECT id FROM device_filter)
        GROUP BY d.cpe_type
      ),
      device_counts AS (
        SELECT 
          d.cpe_type,
          COUNT(*) as total_devices,
          COUNT(*) FILTER (WHERE status = 'online') as online_devices
        FROM devices_ont d
        WHERE d.cpe_type IS NOT NULL AND d.cpe_type != ''
          AND d.id IN (SELECT id FROM device_filter)
        GROUP BY d.cpe_type
      )
      SELECT 
        dc.cpe_type as name,
        dc.total_devices,
        dc.online_devices,
        COALESCE(ds.avg_download, 0) as avg_download,
        COALESCE(us.avg_upload, 0) as avg_upload,
        COALESCE(ps.avg_igw_latency, 0) as avg_igw_latency,
        COALESCE(ps.avg_ebr_latency, 0) as avg_ebr_latency,
        COALESCE(pls.avg_packet_loss_igw, 0) as avg_packet_loss_igw,
        COALESCE(pls.avg_packet_loss_ebr, 0) as avg_packet_loss_ebr,
        COALESCE(ds.download_tests, 0) as download_tests,
        COALESCE(us.upload_tests, 0) as upload_tests,
        COALESCE(ps.ping_tests, 0) as ping_tests,
        COALESCE(pls.packet_loss_tests, 0) as packet_loss_tests
      FROM device_counts dc
      LEFT JOIN download_stats ds ON ds.cpe_type = dc.cpe_type
      LEFT JOIN upload_stats us ON us.cpe_type = dc.cpe_type
      LEFT JOIN ping_stats ps ON ps.cpe_type = dc.cpe_type
      LEFT JOIN packet_loss_stats pls ON pls.cpe_type = dc.cpe_type
      ORDER BY dc.total_devices DESC
    `, filterParams.length > 0 ? filterParams : undefined)

    client.release()

    return NextResponse.json({ data: result.rows })
  } catch (error: any) {
    console.error('ONT type comparison error:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch ONT type comparison' }, { status: 500 })
  }
}
