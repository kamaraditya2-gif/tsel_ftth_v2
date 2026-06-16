import { NextResponse } from 'next/server'
import pool from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET() {
  let client
  try {
    client = await pool.connect()

    const [pingTrends, downloadTrends, uploadTrends] = await Promise.all([
      client.query(`
        SELECT
          DATE_TRUNC('hour', executed_at) as hour_bucket,
          AVG(ping_igw) as avg_ping_igw,
          AVG(ping_ebr) as avg_ping_ebr,
          AVG(packet_loss_igw) as avg_packet_loss,
          COUNT(*) as sample_count
        FROM test_results_ping
        WHERE executed_at > NOW() - INTERVAL '24 hours'
        GROUP BY DATE_TRUNC('hour', executed_at)
        ORDER BY hour_bucket ASC
      `),
      client.query(`
        SELECT
          DATE_TRUNC('hour', executed_at) as hour_bucket,
          AVG(download_speed) as avg_download_speed,
          COUNT(*) as sample_count
        FROM test_results_speed_download
        WHERE executed_at > NOW() - INTERVAL '24 hours'
        GROUP BY DATE_TRUNC('hour', executed_at)
        ORDER BY hour_bucket ASC
      `),
      client.query(`
        SELECT
          DATE_TRUNC('hour', executed_at) as hour_bucket,
          AVG(upload_speed) as avg_upload_speed,
          COUNT(*) as sample_count
        FROM test_results_speed_upload
        WHERE executed_at > NOW() - INTERVAL '24 hours'
        GROUP BY DATE_TRUNC('hour', executed_at)
        ORDER BY hour_bucket ASC
      `)
    ])

    const pingMap = new Map()
    for (const row of pingTrends.rows) {
      pingMap.set(row.hour_bucket.getTime(), {
        avg_ping_igw: parseFloat(row.avg_ping_igw) || 0,
        avg_ping_ebr: parseFloat(row.avg_ping_ebr) || 0,
        avg_packet_loss: parseFloat(row.avg_packet_loss) || 0,
        sample_count: parseInt(row.sample_count)
      })
    }

    const downloadMap = new Map()
    for (const row of downloadTrends.rows) {
      downloadMap.set(row.hour_bucket.getTime(), {
        avg_download_speed: parseFloat(row.avg_download_speed) || 0,
        sample_count: parseInt(row.sample_count)
      })
    }

    const uploadMap = new Map()
    for (const row of uploadTrends.rows) {
      uploadMap.set(row.hour_bucket.getTime(), {
        avg_upload_speed: parseFloat(row.avg_upload_speed) || 0,
        sample_count: parseInt(row.sample_count)
      })
    }

    const allBuckets = new Set([
      ...Array.from(pingMap.keys()),
      ...Array.from(downloadMap.keys()),
      ...Array.from(uploadMap.keys())
    ])

    const merged = Array.from(allBuckets)
      .sort((a, b) => a - b)
      .map(ts => {
        const ping = pingMap.get(ts) || {}
        const download = downloadMap.get(ts) || {}
        const upload = uploadMap.get(ts) || {}
        return {
          hour: new Date(ts).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Jakarta'
          }),
          avg_ping_igw: ping.avg_ping_igw || 0,
          avg_ping_ebr: ping.avg_ping_ebr || 0,
          avg_packet_loss: ping.avg_packet_loss || 0,
          avg_download_speed: download.avg_download_speed || 0,
          avg_upload_speed: upload.avg_upload_speed || 0
        }
      })

    return NextResponse.json(merged)
  } catch (error) {
    console.error('Error fetching aggregated trends:', error)
    return NextResponse.json([])
  } finally {
    if (client) client.release()
  }
}
