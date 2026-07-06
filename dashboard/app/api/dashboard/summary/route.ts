import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { parseIds, buildOptionalFilter } from '@/lib/filter-utils'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  let client
  try {
    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('timeRange') || '24h'
    const areaId = searchParams.get('areaId')
    const regionalId = searchParams.get('regionalId')
    const nopId = searchParams.get('nopId')
    const speedGroupId = searchParams.get('speedGroupId')
    const manufacturerId = searchParams.get('manufacturerId')
    const ontModelId = searchParams.get('ontModelId')

    // Map timeRange to PostgreSQL interval
    const intervalMap: Record<string, string> = {
      '1h': '1 hour',
      '6h': '6 hours',
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days'
    }
    const interval = intervalMap[timeRange] || '24 hours'

    // Determine truncation unit based on time range
    const truncUnit = ['7d', '30d'].includes(timeRange) ? 'day' : 'hour'

    // Build WHERE clause for regional and speed filters
    const filterConditions: string[] = []
    const filterParams: any[] = []
    let paramIndex = 1

    const areaIdFilter = buildOptionalFilter('area_id', areaId, searchParams.get('areaIds'), () => paramIndex++, filterParams)
    if (areaIdFilter) filterConditions.push(`d.cluster_nop_id IN (SELECT id FROM master_cluster_nop WHERE ${areaIdFilter})`)

    const regionalIdFilter = buildOptionalFilter('d.downstream_server_id', regionalId, searchParams.get('regionalIds'), () => paramIndex++, filterParams)
    if (regionalIdFilter) filterConditions.push(regionalIdFilter)

    const nopIdFilter = buildOptionalFilter('d.cluster_nop_id', nopId, searchParams.get('nopIds'), () => paramIndex++, filterParams)
    if (nopIdFilter) filterConditions.push(nopIdFilter)

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

    const whereClause = filterConditions.length > 0 ? `WHERE ${filterConditions.join(' AND ')}` : ''
    const whereClauseWithTime = filterConditions.length > 0 ? `AND ${filterConditions.join(' AND ')}` : ''
    const whereClauseWithTimeDev = filterConditions.length > 0 ? `AND ${filterConditions.map(c => c.replace(/d\./g, 'dev.')).join(' AND ')}` : ''
    const whereClauseWithTimeDd = filterConditions.length > 0 ? `AND ${filterConditions.map(c => c.replace(/d\./g, 'dd.')).join(' AND ')}` : ''
    const devExistsConditions = filterConditions.map(c => c.replace(/d\./g, 'dev_exists.'))
    const devExistsWhere = devExistsConditions.length > 0 ? devExistsConditions.join(' AND ') : '1=1'
    const devExists2Conditions = filterConditions.map(c => c.replace(/d\./g, 'dev_exists2.'))
    const devExists2Where = devExists2Conditions.length > 0 ? devExists2Conditions.join(' AND ') : '1=1'

    client = await pool.connect()

    // Get total devices
    let devicesQuery = 'SELECT COUNT(*) as count FROM devices_ont d'
    const devicesParams = [...filterParams]
    if (whereClause) {
      devicesQuery += ` ${whereClause}`
    }
    const devicesRes = await client.query(devicesQuery, devicesParams)
    const totalDevices = parseInt(devicesRes.rows[0].count)

    // Get device status breakdown
    const statusRes = await client.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online,
        SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline
      FROM devices_ont d
      ${whereClause}
    `, filterParams)
    const deviceStatus = statusRes.rows[0]

    // Get total test results in time range from queue_jobs
    const totalTestsRes = await client.query(`
      SELECT COUNT(*) as count
      FROM queue_jobs qj
      JOIN devices_ont d ON qj.device_id = d.id
      WHERE qj.created_at > NOW() - INTERVAL '${interval}' ${whereClauseWithTime}
    `, filterParams)
    const totalTests = parseInt(totalTestsRes.rows[0].count)

    // Get success rate from queue_jobs
    const successRes = await client.query(`
      SELECT
        SUM(CASE WHEN qj.status = 'completed' THEN 1 ELSE 0 END)::float /
        NULLIF(COUNT(*), 0) * 100 as rate
      FROM queue_jobs qj
      JOIN devices_ont d ON qj.device_id = d.id
      WHERE qj.created_at > NOW() - INTERVAL '${interval}' ${whereClauseWithTime}
    `, filterParams)
    const successRate = successRes.rows[0].rate ? parseFloat(successRes.rows[0].rate).toFixed(1) : 0

    // Get avg ping (near IGW and near EBR) from test_results_ping table
    const pingIgwRes = await client.query(`
      SELECT AVG(ping_igw) as avg
      FROM test_results_ping
      JOIN devices_ont d ON test_results_ping.device_id = d.id
      WHERE executed_at > NOW() - INTERVAL '${interval}' AND ping_igw IS NOT NULL ${whereClauseWithTime}
    `, filterParams)
    const avgPingIgw = pingIgwRes.rows[0].avg ? parseFloat(pingIgwRes.rows[0].avg).toFixed(2) : 0

    const pingEbrRes = await client.query(`
      SELECT AVG(ping_ebr) as avg
      FROM test_results_ping
      JOIN devices_ont d ON test_results_ping.device_id = d.id
      WHERE executed_at > NOW() - INTERVAL '${interval}' AND ping_ebr IS NOT NULL ${whereClauseWithTime}
    `, filterParams)
    const avgPingEbr = pingEbrRes.rows[0].avg ? parseFloat(pingEbrRes.rows[0].avg).toFixed(2) : 0

    // Get avg packet loss from test_results_ping table
    const packetLossRes = await client.query(`
      SELECT AVG(packet_loss_igw) as avg
      FROM test_results_ping
      JOIN devices_ont d ON test_results_ping.device_id = d.id
      WHERE executed_at > NOW() - INTERVAL '${interval}' AND packet_loss_igw IS NOT NULL ${whereClauseWithTime}
    `, filterParams)
    const avgPacketLoss = packetLossRes.rows[0].avg ? parseFloat(packetLossRes.rows[0].avg).toFixed(2) : 0

    // Get avg download and upload from separate speed tables
    const speedRes = await client.query(`
      SELECT
        AVG(d.download_speed) as avg_download,
        AVG(u.upload_speed) as avg_upload
      FROM test_results_speed_download d
      FULL OUTER JOIN test_results_speed_upload u ON d.device_id = u.device_id
      JOIN devices_ont dev ON d.device_id = dev.id OR u.device_id = dev.id
      WHERE (d.executed_at > NOW() - INTERVAL '${interval}' OR u.executed_at > NOW() - INTERVAL '${interval}') ${whereClauseWithTimeDev}
    `, filterParams)
    const avgDownload = speedRes.rows[0].avg_download ? parseFloat(speedRes.rows[0].avg_download).toFixed(2) : 0
    const avgUpload = speedRes.rows[0].avg_upload ? parseFloat(speedRes.rows[0].avg_upload).toFixed(2) : 0

    // Get active alerts (failed jobs in last hour)
    const alertsRes = await client.query(`
      SELECT COUNT(*) as count
      FROM queue_jobs qj
      JOIN devices_ont d ON qj.device_id = d.id
      WHERE qj.status = 'failed' AND qj.created_at > NOW() - INTERVAL '1 hour' ${whereClauseWithTime}
    `, filterParams)
    const activeAlerts = parseInt(alertsRes.rows[0].count)

    // Get ping data for chart with MIN, MAX, AVG from test_results_ping table
    // Use generate_series to ensure all time periods are included even if no data
    const pingChartRes = await client.query(`
      SELECT
        time_period,
        AVG(ping_igw) as avg_ping_igw,
        MIN(ping_igw) as min_ping_igw,
        MAX(ping_igw) as max_ping_igw,
        AVG(ping_ebr) as avg_ping_ebr,
        MIN(ping_ebr) as min_ping_ebr,
        MAX(ping_ebr) as max_ping_ebr
      FROM generate_series(
        DATE_TRUNC('${truncUnit}', NOW() - INTERVAL '${interval}'),
        DATE_TRUNC('${truncUnit}', NOW()),
        CASE
          WHEN '${truncUnit}' = 'hour' THEN INTERVAL '1 hour'
          WHEN '${truncUnit}' = 'day' THEN INTERVAL '1 day'
          ELSE INTERVAL '1 hour'
        END
      ) AS time_period
      LEFT JOIN test_results_ping trp ON
        DATE_TRUNC('${truncUnit}', trp.executed_at) = time_period
        AND trp.executed_at > NOW() - INTERVAL '${interval}'
        ${filterConditions.length > 0 ? `AND EXISTS (
          SELECT 1 FROM devices_ont dev_exists WHERE dev_exists.id = trp.device_id AND ${devExistsWhere}
        )` : ''}
      GROUP BY time_period
      ORDER BY time_period ASC
    `, filterParams)
    
    // Calculate overall MIN, MAX, AVG for near IGW and near EBR from test_results_ping table
    const pingStatsRes = await client.query(`
      SELECT
        AVG(ping_igw) as avg_ping_igw,
        MIN(ping_igw) as min_ping_igw,
        MAX(ping_igw) as max_ping_igw,
        AVG(ping_ebr) as avg_ping_ebr,
        MIN(ping_ebr) as min_ping_ebr,
        MAX(ping_ebr) as max_ping_ebr
      FROM test_results_ping
      JOIN devices_ont d ON test_results_ping.device_id = d.id
      WHERE executed_at > NOW() - INTERVAL '${interval}' ${whereClauseWithTime}
    `, filterParams)
    
    const pingStats = pingStatsRes.rows[0] || null
    
    const pingData = pingChartRes.rows.map(row => ({
      hour: truncUnit === 'day'
        ? new Date(row.time_period).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : new Date(row.time_period).getHours() + ':00',
      igw: row.avg_ping_igw != null ? parseFloat(Number(row.avg_ping_igw).toFixed(2)) : 0,
      igw_min: row.min_ping_igw != null ? parseFloat(Number(row.min_ping_igw).toFixed(2)) : 0,
      igw_max: row.max_ping_igw != null ? parseFloat(Number(row.max_ping_igw).toFixed(2)) : 0,
      ebr: row.avg_ping_ebr != null ? parseFloat(Number(row.avg_ping_ebr).toFixed(2)) : 0,
      ebr_min: row.min_ping_ebr != null ? parseFloat(Number(row.min_ping_ebr).toFixed(2)) : 0,
      ebr_max: row.max_ping_ebr != null ? parseFloat(Number(row.max_ping_ebr).toFixed(2)) : 0
    }))

    // Get speed data for chart with MIN, MAX, AVG from separate download and upload tables
    // Use generate_series to ensure all time periods are included even if no data
    const speedChartRes = await client.query(`
      SELECT
        time_period,
        AVG(download_speed) as avg_download,
        MIN(download_speed) as min_download,
        MAX(download_speed) as max_download,
        AVG(upload_speed) as avg_upload,
        MIN(upload_speed) as min_upload,
        MAX(upload_speed) as max_upload
      FROM generate_series(
        DATE_TRUNC('${truncUnit}', NOW() - INTERVAL '${interval}'),
        DATE_TRUNC('${truncUnit}', NOW()),
        CASE
          WHEN '${truncUnit}' = 'hour' THEN INTERVAL '1 hour'
          WHEN '${truncUnit}' = 'day' THEN INTERVAL '1 day'
          ELSE INTERVAL '1 hour'
        END
      ) AS time_period
      LEFT JOIN test_results_speed_download sd ON
        DATE_TRUNC('${truncUnit}', sd.executed_at) = time_period
        AND sd.executed_at > NOW() - INTERVAL '${interval}'
        ${filterConditions.length > 0 ? `AND EXISTS (
          SELECT 1 FROM devices_ont dev_exists WHERE dev_exists.id = sd.device_id AND ${devExistsWhere}
        )` : ''}
      LEFT JOIN test_results_speed_upload su ON
        DATE_TRUNC('${truncUnit}', su.executed_at) = time_period
        AND su.executed_at > NOW() - INTERVAL '${interval}'
        ${filterConditions.length > 0 ? `AND EXISTS (
          SELECT 1 FROM devices_ont dev_exists2 WHERE dev_exists2.id = su.device_id AND ${devExists2Where}
        )` : ''}
      GROUP BY time_period
      ORDER BY time_period ASC
    `, filterParams)
    
    // Calculate overall MIN, MAX, AVG for download and upload from separate tables
    const speedStatsRes = await client.query(`
      SELECT
        AVG(d.download_speed) as avg_download,
        MIN(d.download_speed) as min_download,
        MAX(d.download_speed) as max_download,
        AVG(u.upload_speed) as avg_upload,
        MIN(u.upload_speed) as min_upload,
        MAX(u.upload_speed) as max_upload
      FROM test_results_speed_download d
      FULL OUTER JOIN test_results_speed_upload u ON d.device_id = u.device_id
      JOIN devices_ont dd ON d.device_id = dd.id OR u.device_id = dd.id
      WHERE (d.executed_at > NOW() - INTERVAL '${interval}' OR u.executed_at > NOW() - INTERVAL '${interval}') ${whereClauseWithTimeDd}
    `, filterParams)
    
    const speedStats = speedStatsRes.rows[0] || null
    
    const speedData = speedChartRes.rows.map(row => ({
      hour: truncUnit === 'day' 
        ? new Date(row.time_period).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : new Date(row.time_period).getHours() + ':00',
      avg_download: row.avg_download != null ? parseFloat(Number(row.avg_download).toFixed(2)) : 0,
      min_download: row.min_download != null ? parseFloat(Number(row.min_download).toFixed(2)) : 0,
      max_download: row.max_download != null ? parseFloat(Number(row.max_download).toFixed(2)) : 0,
      avg_upload: row.avg_upload != null ? parseFloat(Number(row.avg_upload).toFixed(2)) : 0,
      min_upload: row.min_upload != null ? parseFloat(Number(row.min_upload).toFixed(2)) : 0,
      max_upload: row.max_upload != null ? parseFloat(Number(row.max_upload).toFixed(2)) : 0
    }))

    // Get top 5 devices for each category from separate tables
    const topDevicesRes = await client.query(`
      SELECT 
        d.id,
        d.device_name,
        d.serial_number,
        d.indihome_id,
        g.name as regional_name,
        sg.name as speed_name,
        p.avg_ping,
        p.max_ping_igw,
        p.max_ping_ebr,
        s.avg_upload,
        s.max_upload,
        s.avg_download,
        s.max_download,
        p.avg_packet_loss,
        p.max_packet_loss
      FROM devices_ont d
      LEFT JOIN group_devices g ON d.group_id = g.id
      LEFT JOIN speed_group sg ON d.speed_id = sg.id
      LEFT JOIN (
        SELECT 
          device_id,
          AVG(ping_igw) as avg_ping,
          MAX(ping_igw) as max_ping_igw,
          MAX(ping_ebr) as max_ping_ebr,
          AVG(packet_loss_igw) as avg_packet_loss,
          MAX(packet_loss_igw) as max_packet_loss
        FROM test_results_ping trp
        JOIN devices_ont dev ON trp.device_id = dev.id
        WHERE trp.executed_at > NOW() - INTERVAL '${interval}' ${whereClauseWithTimeDev}
        GROUP BY trp.device_id
      ) p ON d.id = p.device_id
      LEFT JOIN (
        SELECT 
          COALESCE(sd.device_id, su.device_id) as device_id,
          AVG(su.upload_speed) as avg_upload,
          MAX(su.upload_speed) as max_upload,
          AVG(sd.download_speed) as avg_download,
          MAX(sd.download_speed) as max_download
        FROM test_results_speed_download sd
        FULL OUTER JOIN test_results_speed_upload su ON sd.device_id = su.device_id
        JOIN devices_ont dev ON sd.device_id = dev.id OR su.device_id = dev.id
        WHERE (sd.executed_at > NOW() - INTERVAL '${interval}' OR su.executed_at > NOW() - INTERVAL '${interval}') ${whereClauseWithTimeDev}
        GROUP BY COALESCE(sd.device_id, su.device_id)
      ) s ON d.id = s.device_id
      WHERE (p.avg_ping IS NOT NULL OR s.avg_upload IS NOT NULL OR s.avg_download IS NOT NULL OR p.avg_packet_loss IS NOT NULL)
      ${whereClauseWithTime}
      ORDER BY p.avg_ping ASC NULLS LAST
    `, filterParams)

    const allDevices = topDevicesRes.rows

    // Get top 5 for each category
    const fastestLatency = [...allDevices]
      .filter(d => d.avg_ping !== null)
      .sort((a, b) => a.avg_ping - b.avg_ping)
      .slice(0, 5)

    const slowestLatency = [...allDevices]
      .filter(d => d.max_ping_igw !== null)
      .sort((a, b) => b.max_ping_igw - a.max_ping_igw)
      .slice(0, 5)

    const slowestLatencyEbr = [...allDevices]
      .filter(d => d.max_ping_ebr !== null)
      .sort((a, b) => b.max_ping_ebr - a.max_ping_ebr)
      .slice(0, 5)

    const fastestUpload = [...allDevices]
      .filter(d => d.avg_upload !== null)
      .sort((a, b) => b.avg_upload - a.avg_upload)
      .slice(0, 5)

    const slowestUpload = [...allDevices]
      .filter(d => d.avg_upload !== null)
      .sort((a, b) => a.avg_upload - b.avg_upload)
      .slice(0, 5)

    const fastestDownload = [...allDevices]
      .filter(d => d.avg_download !== null)
      .sort((a, b) => b.avg_download - a.avg_download)
      .slice(0, 5)

    const slowestDownload = [...allDevices]
      .filter(d => d.avg_download !== null)
      .sort((a, b) => a.avg_download - b.avg_download)
      .slice(0, 5)

    const highestPacketLoss = [...allDevices]
      .filter(d => d.avg_packet_loss !== null)
      .sort((a, b) => b.avg_packet_loss - a.avg_packet_loss)
      .slice(0, 5)

    // Get devices below download threshold
    const belowDownloadThresholdRes = await client.query(`
      SELECT 
        d.id,
        d.device_name,
        d.serial_number,
        d.indihome_id,
        g.name as regional_name,
        sg.name as speed_name,
        sg.download_threshold,
        AVG(sd.download_speed) as avg_download
      FROM devices_ont d
      LEFT JOIN group_devices g ON d.group_id = g.id
      LEFT JOIN speed_group sg ON d.speed_id = sg.id
      LEFT JOIN test_results_speed_download sd ON d.id = sd.device_id
      WHERE sd.executed_at > NOW() - INTERVAL '${interval}'
        AND sg.download_threshold IS NOT NULL
        ${whereClauseWithTime}
      GROUP BY d.id, d.device_name, d.serial_number, d.indihome_id, g.name, sg.name, sg.download_threshold
      HAVING AVG(sd.download_speed) < sg.download_threshold
      ORDER BY AVG(sd.download_speed) ASC
      LIMIT 5
    `, filterParams)

    // Get devices below upload threshold
    const belowUploadThresholdRes = await client.query(`
      SELECT 
        d.id,
        d.device_name,
        d.serial_number,
        d.indihome_id,
        g.name as regional_name,
        sg.name as speed_name,
        sg.upload_threshold,
        AVG(su.upload_speed) as avg_upload
      FROM devices_ont d
      LEFT JOIN group_devices g ON d.group_id = g.id
      LEFT JOIN speed_group sg ON d.speed_id = sg.id
      LEFT JOIN test_results_speed_upload su ON d.id = su.device_id
      WHERE su.executed_at > NOW() - INTERVAL '${interval}'
        AND sg.upload_threshold IS NOT NULL
        ${whereClauseWithTime}
      GROUP BY d.id, d.device_name, d.serial_number, d.indihome_id, g.name, sg.name, sg.upload_threshold
      HAVING AVG(su.upload_speed) < sg.upload_threshold
      ORDER BY AVG(su.upload_speed) ASC
      LIMIT 5
    `, filterParams)

    // Device counts by speed package
    let speedPackages: { name: string; count: number }[] = []
    try {
      const spRes = await client.query(`
        SELECT COALESCE(sg.name, 'No Package') as name, COUNT(*) as count
        FROM devices_ont d LEFT JOIN speed_group sg ON d.speed_id = sg.id
        GROUP BY sg.name ORDER BY sg.speed_limit ASC NULLS LAST
      `)
      speedPackages = spRes.rows.map(r => ({ name: r.name, count: parseInt(r.count) }))
    } catch (e) { /* ignore */ }

    return NextResponse.json({
      totalDevices,
      speedPackages,
      deviceStatus: {
        total: parseInt(deviceStatus.total),
        online: parseInt(deviceStatus.online),
        offline: parseInt(deviceStatus.offline)
      },
      totalTests,
      successRate,
      avgPingIgw,
      avgPingEbr,
      avgPacketLoss,
      avgDownload,
      avgUpload,
      activeAlerts,
      pingData,
      pingStats: pingStats ? {
        igw: {
          min: pingStats.min_ping_igw != null ? parseFloat(Number(pingStats.min_ping_igw).toFixed(2)) : 0,
          max: pingStats.max_ping_igw != null ? parseFloat(Number(pingStats.max_ping_igw).toFixed(2)) : 0,
          avg: pingStats.avg_ping_igw != null ? parseFloat(Number(pingStats.avg_ping_igw).toFixed(2)) : 0
        },
        ebr: {
          min: pingStats.min_ping_ebr != null ? parseFloat(Number(pingStats.min_ping_ebr).toFixed(2)) : 0,
          max: pingStats.max_ping_ebr != null ? parseFloat(Number(pingStats.max_ping_ebr).toFixed(2)) : 0,
          avg: pingStats.avg_ping_ebr != null ? parseFloat(Number(pingStats.avg_ping_ebr).toFixed(2)) : 0
        }
      } : null,
      speedData,
      speedStats: speedStats ? {
        download: {
          min: speedStats.min_download != null ? parseFloat(Number(speedStats.min_download).toFixed(2)) : 0,
          max: speedStats.max_download != null ? parseFloat(Number(speedStats.max_download).toFixed(2)) : 0,
          avg: speedStats.avg_download != null ? parseFloat(Number(speedStats.avg_download).toFixed(2)) : 0
        },
        upload: {
          min: speedStats.min_upload != null ? parseFloat(Number(speedStats.min_upload).toFixed(2)) : 0,
          max: speedStats.max_upload != null ? parseFloat(Number(speedStats.max_upload).toFixed(2)) : 0,
          avg: speedStats.avg_upload != null ? parseFloat(Number(speedStats.avg_upload).toFixed(2)) : 0
        }
      } : null,
      topDevices: {
        fastestLatency: fastestLatency.map(d => ({
          id: d.id,
          deviceName: d.device_name,
          serialNumber: d.serial_number,
          indihomeId: d.indihome_id,
          regionalName: d.regional_name,
          speedName: d.speed_name,
          value: d.avg_ping != null ? parseFloat(Number(d.avg_ping).toFixed(2)) : 0
        })),
        slowestLatencyIgw: slowestLatency.map(d => ({
          id: d.id,
          deviceName: d.device_name,
          serialNumber: d.serial_number,
          indihomeId: d.indihome_id,
          regionalName: d.regional_name,
          speedName: d.speed_name,
          value: d.max_ping_igw != null ? parseFloat(Number(d.max_ping_igw).toFixed(2)) : 0
        })),
        slowestLatencyEbr: slowestLatencyEbr.map(d => ({
          id: d.id,
          deviceName: d.device_name,
          serialNumber: d.serial_number,
          indihomeId: d.indihome_id,
          regionalName: d.regional_name,
          speedName: d.speed_name,
          value: d.max_ping_ebr != null ? parseFloat(Number(d.max_ping_ebr).toFixed(2)) : 0
        })),
        fastestUpload: fastestUpload.map(d => ({
          id: d.id,
          deviceName: d.device_name,
          serialNumber: d.serial_number,
          indihomeId: d.indihome_id,
          regionalName: d.regional_name,
          speedName: d.speed_name,
          value: d.avg_upload != null ? parseFloat(Number(d.avg_upload).toFixed(2)) : 0
        })),
        slowestUpload: slowestUpload.map(d => ({
          id: d.id,
          deviceName: d.device_name,
          serialNumber: d.serial_number,
          indihomeId: d.indihome_id,
          regionalName: d.regional_name,
          speedName: d.speed_name,
          value: d.avg_upload != null ? parseFloat(Number(d.avg_upload).toFixed(2)) : 0
        })),
        fastestDownload: fastestDownload.map(d => ({
          id: d.id,
          deviceName: d.device_name,
          serialNumber: d.serial_number,
          indihomeId: d.indihome_id,
          regionalName: d.regional_name,
          speedName: d.speed_name,
          value: d.avg_download != null ? parseFloat(Number(d.avg_download).toFixed(2)) : 0
        })),
        slowestDownload: slowestDownload.map(d => ({
          id: d.id,
          deviceName: d.device_name,
          serialNumber: d.serial_number,
          indihomeId: d.indihome_id,
          regionalName: d.regional_name,
          speedName: d.speed_name,
          value: d.avg_download != null ? parseFloat(Number(d.avg_download).toFixed(2)) : 0
        })),
        highestPacketLoss: highestPacketLoss.map(d => ({
          id: d.id,
          deviceName: d.device_name,
          serialNumber: d.serial_number,
          indihomeId: d.indihome_id,
          regionalName: d.regional_name,
          speedName: d.speed_name,
          value: d.avg_packet_loss != null ? parseFloat(Number(d.avg_packet_loss).toFixed(2)) : 0
        })),
        belowDownloadThreshold: belowDownloadThresholdRes.rows.map(d => ({
          id: d.id,
          deviceName: d.device_name,
          serialNumber: d.serial_number,
          indihomeId: d.indihome_id,
          regionalName: d.regional_name,
          speedName: d.speed_name,
          value: d.avg_download != null ? parseFloat(Number(d.avg_download).toFixed(2)) : 0,
          threshold: d.download_threshold != null ? parseFloat(Number(d.download_threshold).toFixed(2)) : 0
        })),
        belowUploadThreshold: belowUploadThresholdRes.rows.map(d => ({
          id: d.id,
          deviceName: d.device_name,
          serialNumber: d.serial_number,
          indihomeId: d.indihome_id,
          regionalName: d.regional_name,
          speedName: d.speed_name,
          value: d.avg_upload != null ? parseFloat(Number(d.avg_upload).toFixed(2)) : 0,
          threshold: d.upload_threshold != null ? parseFloat(Number(d.upload_threshold).toFixed(2)) : 0
        }))
      }
    })
  } catch (error) {
    console.error('Dashboard summary error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error details:', errorMessage)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data', details: errorMessage },
      { status: 500 }
    )
  } finally {
    if (client) client.release()
  }
}
