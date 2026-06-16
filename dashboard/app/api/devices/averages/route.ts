import { NextResponse } from 'next/server'
import pool from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET() {
  let client
  try {
    client = await pool.connect()

    const [pingStats, downloadStats, uploadStats, deviceCounts, successStats] = await Promise.all([
      client.query(`
        SELECT
          AVG(ping_igw) as avg_ping_igw,
          AVG(ping_ebr) as avg_ping_ebr,
          AVG(packet_loss_igw) as avg_packet_loss_igw,
          AVG(packet_loss_ebr) as avg_packet_loss_ebr
        FROM test_results_ping
        WHERE executed_at > NOW() - INTERVAL '24 hours'
      `),
      client.query(`
        SELECT AVG(download_speed) as avg_download_speed
        FROM test_results_speed_download
        WHERE executed_at > NOW() - INTERVAL '24 hours'
      `),
      client.query(`
        SELECT AVG(upload_speed) as avg_upload_speed
        FROM test_results_speed_upload
        WHERE executed_at > NOW() - INTERVAL '24 hours'
      `),
      client.query(`
        SELECT
          COUNT(*) as total_devices,
          SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online_count,
          SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline_count
        FROM devices_ont
      `),
      client.query(`
        SELECT
          COUNT(*) as total_tests,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as success_count
        FROM queue_jobs
        WHERE created_at > NOW() - INTERVAL '24 hours'
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
