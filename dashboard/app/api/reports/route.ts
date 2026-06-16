import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

function buildDateFilter(dateFrom: string | null, dateTo: string | null, prefix: string): { sql: string, params: string[] } {
  let sql = ''
  const params: string[] = []
  if (dateFrom) {
    sql += ` AND ${prefix}.executed_at >= $${params.length + 1}`
    params.push(dateFrom)
  }
  if (dateTo) {
    sql += ` AND ${prefix}.executed_at <= $${params.length + 1}`
    params.push(dateTo + ' 23:59:59')
  }
  return { sql, params }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'all'
    const id = searchParams.get('id')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')

    const dfDownload = buildDateFilter(dateFrom, dateTo, 'rsd')
    const dfUpload = buildDateFilter(dateFrom, dateTo, 'rsu')
    const dfPing = buildDateFilter(dateFrom, dateTo, 'rp')

    // Build grouping and filter based on type
    let groupBy = ''
    let selectGroup = ''
    let orderBy = ''
    let joinFilter = ''

    if (type === 'regional') {
      selectGroup = `gd.id as group_id, gd.name as group_name, gd.code as group_code`
      groupBy = `gd.id, gd.name, gd.code`
      orderBy = `gd.name`
      if (id) joinFilter = ` AND gd.id = ${parseInt(id)}`
    } else if (type === 'speed') {
      selectGroup = `sg.id as group_id, sg.name as group_name, sg.speed_limit as group_limit`
      groupBy = `sg.id, sg.name, sg.speed_limit`
      orderBy = `sg.name`
      if (id) joinFilter = ` AND sg.id = ${parseInt(id)}`
    } else if (type === 'cpe_type') {
      selectGroup = `d.cpe_type as group_id, d.cpe_type as group_name`
      groupBy = `d.cpe_type`
      orderBy = `d.cpe_type`
      if (id) joinFilter = ` AND d.cpe_type = '${id.replace(/'/g, "''")}'`
    } else {
      selectGroup = `NULL::int as group_id, 'All Devices' as group_name`
      groupBy = `1`
      orderBy = `1`
    }

    const query = `
      WITH download_stats AS (
        SELECT 
          rsd.device_id,
          AVG(rsd.download_speed) as avg_download,
          COUNT(*) as download_count
        FROM test_results_speed_download rsd
        WHERE 1=1 ${dfDownload.sql}
        GROUP BY rsd.device_id
      ),
      upload_stats AS (
        SELECT 
          rsu.device_id,
          AVG(rsu.upload_speed) as avg_upload,
          COUNT(*) as upload_count
        FROM test_results_speed_upload rsu
        WHERE 1=1 ${dfUpload.sql}
        GROUP BY rsu.device_id
      ),
      ping_stats AS (
        SELECT 
          rp.device_id,
          AVG(rp.ping_igw) as avg_ping_igw,
          AVG(rp.ping_ebr) as avg_ping_ebr,
          AVG(rp.packet_loss_igw) as avg_packet_loss_igw,
          AVG(rp.packet_loss_ebr) as avg_packet_loss_ebr,
          COUNT(*) as ping_count
        FROM test_results_ping rp
        WHERE 1=1 ${dfPing.sql}
        GROUP BY rp.device_id
      ),
      device_aggregates AS (
        SELECT 
          d.id as device_id,
          d.device_name,
          d.serial_number,
          d.cpe_type,
          d.manufacturer,
          d.model,
          gd.id as regional_id,
          gd.name as regional_name,
          sg.id as speed_id,
          sg.name as speed_name,
          COALESCE(ds.avg_download, 0) as avg_download,
          COALESCE(ds.download_count, 0) as download_count,
          COALESCE(us.avg_upload, 0) as avg_upload,
          COALESCE(us.upload_count, 0) as upload_count,
          COALESCE(ps.avg_ping_igw, 0) as avg_ping_igw,
          COALESCE(ps.avg_ping_ebr, 0) as avg_ping_ebr,
          COALESCE(ps.avg_packet_loss_igw, 0) as avg_packet_loss_igw,
          COALESCE(ps.avg_packet_loss_ebr, 0) as avg_packet_loss_ebr,
          COALESCE(ps.ping_count, 0) as ping_count
        FROM devices_ont d
        LEFT JOIN group_devices gd ON gd.id = d.group_id
        LEFT JOIN speed_group sg ON sg.id = d.speed_id
        LEFT JOIN download_stats ds ON ds.device_id = d.id
        LEFT JOIN upload_stats us ON us.device_id = d.id
        LEFT JOIN ping_stats ps ON ps.device_id = d.id
        WHERE (ds.device_id IS NOT NULL OR us.device_id IS NOT NULL OR ps.device_id IS NOT NULL)
          ${joinFilter}
      )
      SELECT 
        ${selectGroup},
        COUNT(DISTINCT device_id) as total_devices,
        ROUND(AVG(avg_download)::numeric, 2) as avg_download_speed,
        ROUND(AVG(avg_upload)::numeric, 2) as avg_upload_speed,
        ROUND(AVG(avg_ping_igw)::numeric, 2) as avg_downstream_latency,
        ROUND(AVG(avg_ping_ebr)::numeric, 2) as avg_upstream_latency,
        ROUND(AVG(avg_packet_loss_igw)::numeric, 2) as avg_packet_loss_downstream,
        ROUND(AVG(avg_packet_loss_ebr)::numeric, 2) as avg_packet_loss_upstream,
        SUM(download_count) as total_download_tests,
        SUM(upload_count) as total_upload_tests,
        SUM(ping_count) as total_ping_tests,
        SUM(download_count + upload_count + ping_count) as total_tests
      FROM device_aggregates
      GROUP BY ${groupBy}
      ORDER BY ${orderBy}
    `

    const allParams = [...dfDownload.params, ...dfUpload.params, ...dfPing.params]
    const result = await pool.query(query, allParams)

    // Detail query
    const detailQuery = `
      WITH download_stats AS (
        SELECT device_id, AVG(download_speed) as avg_download, COUNT(*) as download_count
        FROM test_results_speed_download WHERE 1=1 ${dfDownload.sql}
        GROUP BY device_id
      ),
      upload_stats AS (
        SELECT device_id, AVG(upload_speed) as avg_upload, COUNT(*) as upload_count
        FROM test_results_speed_upload WHERE 1=1 ${dfUpload.sql}
        GROUP BY device_id
      ),
      ping_stats AS (
        SELECT device_id, AVG(ping_igw) as avg_ping_igw, AVG(ping_ebr) as avg_ping_ebr,
               AVG(packet_loss_igw) as avg_packet_loss_igw, AVG(packet_loss_ebr) as avg_packet_loss_ebr, COUNT(*) as ping_count
        FROM test_results_ping WHERE 1=1 ${dfPing.sql}
        GROUP BY device_id
      )
      SELECT 
        d.id as device_id, d.device_name, d.serial_number, d.cpe_type, d.manufacturer, d.model,
        gd.name as regional_name, sg.name as speed_name,
        COALESCE(ds.avg_download, 0) as avg_download_speed,
        COALESCE(us.avg_upload, 0) as avg_upload_speed,
        COALESCE(ps.avg_ping_igw, 0) as avg_downstream_latency,
        COALESCE(ps.avg_ping_ebr, 0) as avg_upstream_latency,
        COALESCE(ps.avg_packet_loss_igw, 0) as avg_packet_loss_downstream,
        COALESCE(ps.avg_packet_loss_ebr, 0) as avg_packet_loss_upstream,
        COALESCE(ds.download_count, 0) + COALESCE(us.upload_count, 0) + COALESCE(ps.ping_count, 0) as total_tests
      FROM devices_ont d
      LEFT JOIN group_devices gd ON gd.id = d.group_id
      LEFT JOIN speed_group sg ON sg.id = d.speed_id
      LEFT JOIN download_stats ds ON ds.device_id = d.id
      LEFT JOIN upload_stats us ON us.device_id = d.id
      LEFT JOIN ping_stats ps ON ps.device_id = d.id
      WHERE (ds.device_id IS NOT NULL OR us.device_id IS NOT NULL OR ps.device_id IS NOT NULL)
        ${joinFilter}
      ORDER BY d.device_name
      LIMIT 500
    `

    const detailResult = await pool.query(detailQuery, allParams)

    // Calculate summary
    const summary = {
      total_devices: result.rows.reduce((sum: number, r: any) => sum + (parseInt(r.total_devices) || 0), 0),
      total_download_tests: result.rows.reduce((sum: number, r: any) => sum + (parseInt(r.total_download_tests) || 0), 0),
      total_upload_tests: result.rows.reduce((sum: number, r: any) => sum + (parseInt(r.total_upload_tests) || 0), 0),
      total_ping_tests: result.rows.reduce((sum: number, r: any) => sum + (parseInt(r.total_ping_tests) || 0), 0),
    }

    return NextResponse.json({
      data: result.rows,
      details: detailResult.rows,
      summary,
      type,
      filters: { dateFrom, dateTo, id }
    })
  } catch (error: any) {
    console.error('Error generating report:', error)
    return NextResponse.json(
      { error: 'Failed to generate report', details: error.message },
      { status: 500 }
    )
  }
}
