import { NextResponse } from 'next/server'
import pool from '@/lib/db'
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

    if (areaId) {
      deviceFilter.push(`d.cluster_nop_id IN (SELECT id FROM master_cluster_nop WHERE area_id = $${paramIndex})`)
      filterParams.push(parseInt(areaId))
      paramIndex++
    }
    if (regionalId) {
      deviceFilter.push(`d.downstream_server_id = $${paramIndex}`)
      filterParams.push(parseInt(regionalId))
      paramIndex++
    }
    if (nopId) {
      deviceFilter.push(`d.cluster_nop_id = $${paramIndex}`)
      filterParams.push(parseInt(nopId))
      paramIndex++
    }

    const joinClause = deviceFilter.length > 0
      ? `JOIN devices_ont d ON tp.device_id = d.id AND ${deviceFilter.join(' AND ')}`
      : ''
    const joinClauseDL = deviceFilter.length > 0
      ? `JOIN devices_ont d ON td.device_id = d.id AND ${deviceFilter.join(' AND ')}`
      : ''
    const joinClauseUL = deviceFilter.length > 0
      ? `JOIN devices_ont d ON tu.device_id = d.id AND ${deviceFilter.join(' AND ')}`
      : ''

    client = await pool.connect()

    const [pingTrends, downloadTrends, uploadTrends] = await Promise.all([
      client.query(`
        SELECT
          DATE_TRUNC('hour', tp.executed_at) as hour_bucket,
          AVG(tp.ping_igw) as avg_ping_igw,
          AVG(tp.ping_ebr) as avg_ping_ebr,
          AVG(tp.packet_loss_igw) as avg_packet_loss,
          COUNT(*) as sample_count
        FROM test_results_ping tp
        ${joinClause}
        WHERE tp.executed_at > NOW() - INTERVAL '24 hours'
        GROUP BY DATE_TRUNC('hour', tp.executed_at)
        ORDER BY hour_bucket ASC
      `, filterParams),
      client.query(`
        SELECT
          DATE_TRUNC('hour', td.executed_at) as hour_bucket,
          AVG(td.download_speed) as avg_download_speed,
          COUNT(*) as sample_count
        FROM test_results_speed_download td
        ${joinClauseDL}
        WHERE td.executed_at > NOW() - INTERVAL '24 hours'
        GROUP BY DATE_TRUNC('hour', td.executed_at)
        ORDER BY hour_bucket ASC
      `, filterParams),
      client.query(`
        SELECT
          DATE_TRUNC('hour', tu.executed_at) as hour_bucket,
          AVG(tu.upload_speed) as avg_upload_speed,
          COUNT(*) as sample_count
        FROM test_results_speed_upload tu
        ${joinClauseUL}
        WHERE tu.executed_at > NOW() - INTERVAL '24 hours'
        GROUP BY DATE_TRUNC('hour', tu.executed_at)
        ORDER BY hour_bucket ASC
      `, filterParams)
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
