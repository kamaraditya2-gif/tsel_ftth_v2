import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { parseIds, buildOptionalFilter } from '@/lib/filter-utils'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  let client
  try {
    const { searchParams } = new URL(request.url)
    const areaId = searchParams.get('area_id')
    const regionalId = searchParams.get('regional_id')
    const nopId = searchParams.get('nop_id')

    const deviceFilter: string[] = []
    const filterParams: any[] = []
    let paramIndex = 1

    const areaIdFilter = buildOptionalFilter('area_id', areaId, searchParams.get('area_ids'), () => paramIndex++, filterParams)
    if (areaIdFilter) deviceFilter.push(`d.cluster_nop_id IN (SELECT id FROM master_cluster_nop WHERE ${areaIdFilter})`)

    const regionalIdFilter = buildOptionalFilter('d.downstream_server_id', regionalId, searchParams.get('regional_ids'), () => paramIndex++, filterParams)
    if (regionalIdFilter) deviceFilter.push(regionalIdFilter)

    const nopIdFilter = buildOptionalFilter('d.cluster_nop_id', nopId, searchParams.get('nop_ids'), () => paramIndex++, filterParams)
    if (nopIdFilter) deviceFilter.push(nopIdFilter)

    const joinClause = deviceFilter.length > 0
      ? `JOIN devices_ont d ON tp.device_id = d.id AND ${deviceFilter.join(' AND ')}`
      : ''
    const joinClauseDL = deviceFilter.length > 0
      ? `JOIN devices_ont d ON td.device_id = d.id AND ${deviceFilter.join(' AND ')}`
      : ''
    const joinClauseUL = deviceFilter.length > 0
      ? `JOIN devices_ont d ON tu.device_id = d.id AND ${deviceFilter.join(' AND ')}`
      : ''
    const deviceWhere = deviceFilter.length > 0
      ? 'AND ' + deviceFilter.join(' AND ').replace(/\bd\./g, 'd2.')
      : ''

    client = await pool.connect()

    const [pingStats, downloadStats, uploadStats, deviceCounts, successStats] = await Promise.all([
      client.query(`
        SELECT
          AVG(tp.ping_igw) as avg_ping_igw,
          AVG(tp.ping_ebr) as avg_ping_ebr,
          AVG(tp.packet_loss_igw) as avg_packet_loss_igw,
          AVG(tp.packet_loss_ebr) as avg_packet_loss_ebr
        FROM test_results_ping tp
        ${joinClause}
        WHERE tp.executed_at > NOW() - INTERVAL '24 hours'
      `, filterParams),
      client.query(`
        SELECT AVG(td.download_speed) as avg_download_speed
        FROM test_results_speed_download td
        ${joinClauseDL}
        WHERE td.executed_at > NOW() - INTERVAL '24 hours'
      `, filterParams),
      client.query(`
        SELECT AVG(tu.upload_speed) as avg_upload_speed
        FROM test_results_speed_upload tu
        ${joinClauseUL}
        WHERE tu.executed_at > NOW() - INTERVAL '24 hours'
      `, filterParams),
      client.query(`
        SELECT
          COUNT(*) as total_devices,
          SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online_count,
          SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline_count
        FROM devices_ont d2
        WHERE 1=1 ${deviceWhere}
      `, filterParams),
      client.query(`
        SELECT
          COUNT(*) as total_tests,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as success_count
        FROM queue_jobs qj
        WHERE qj.created_at > NOW() - INTERVAL '24 hours'
      `)
    ])

    const ping = pingStats.rows[0]
    const download = downloadStats.rows[0]
    const upload = uploadStats.rows[0]
    const counts = deviceCounts.rows[0]
    const success = successStats.rows[0]

    const avgPingIgw = ping.avg_ping_igw ? parseFloat(ping.avg_ping_igw) : 0
    const avgPingEbr = ping.avg_ping_ebr ? parseFloat(ping.avg_ping_ebr) : 0
    const avgPacketLoss = Math.max(
      parseFloat(ping.avg_packet_loss_igw) || 0,
      parseFloat(ping.avg_packet_loss_ebr) || 0
    )
    const avgDownloadSpeed = download.avg_download_speed ? parseFloat(download.avg_download_speed) : 0
    const avgUploadSpeed = upload.avg_upload_speed ? parseFloat(upload.avg_upload_speed) : 0
    const successRate = success.total_tests > 0
      ? (parseInt(success.success_count) / parseInt(success.total_tests)) * 100
      : 0

    return NextResponse.json({
      avg_ping_igw: Math.round(avgPingIgw * 100) / 100,
      avg_ping_ebr: Math.round(avgPingEbr * 100) / 100,
      avg_packet_loss: Math.round(avgPacketLoss * 100) / 100,
      avg_download_speed: Math.round(avgDownloadSpeed * 100) / 100,
      avg_upload_speed: Math.round(avgUploadSpeed * 100) / 100,
      total_devices: parseInt(counts.total_devices),
      online_count: parseInt(counts.online_count || '0'),
      offline_count: parseInt(counts.offline_count || '0'),
      success_rate: Math.round(successRate * 100) / 100,
      total_tests: parseInt(success.total_tests)
    })
  } catch (error) {
    console.error('Error fetching device averages:', error)
    return NextResponse.json({
      avg_ping_igw: 0,
      avg_ping_ebr: 0,
      avg_packet_loss: 0,
      avg_download_speed: 0,
      avg_upload_speed: 0,
      total_devices: 0,
      online_count: 0,
      offline_count: 0,
      success_rate: 0,
      total_tests: 0
    })
  } finally {
    if (client) client.release()
  }
}
