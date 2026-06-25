import { NextResponse } from 'next/server'
import pool from '@/lib/db'
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
    const serverId = searchParams.get('serverId') || '1'

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

    const serverClause = serverId ? `AND t.downstream_server_id = ${parseInt(serverId)}` : ''

    client = await pool.connect()

    // Get latency trend data from test_results_direct_ping
    const latencyQuery = `
      SELECT
        date_trunc('${truncUnit}', t.created_at) as hour,
        AVG(t.avg_latency_ms) as avg_latency
      FROM test_results_direct_ping t
      WHERE t.created_at >= NOW() - INTERVAL '${interval}'
        ${serverClause}
      GROUP BY date_trunc('${truncUnit}', t.created_at)
      ORDER BY hour
    `

    const latencyRes = await client.query(latencyQuery)
    const latencyData = latencyRes.rows.map((row: any) => ({
      hour: new Date(row.hour).toISOString(),
      avg_ping: parseFloat(Number(row.avg_latency || 0).toFixed(2))
    }))

    // Get packet loss trend data from test_results_direct_ping
    const packetLossQuery = `
      SELECT
        date_trunc('${truncUnit}', t.created_at) as hour,
        AVG(t.packet_loss_percent) as avg_packet_loss
      FROM test_results_direct_ping t
      WHERE t.created_at >= NOW() - INTERVAL '${interval}'
        ${serverClause}
      GROUP BY date_trunc('${truncUnit}', t.created_at)
      ORDER BY hour
    `

    const packetLossRes = await client.query(packetLossQuery)
    const packetLossData = packetLossRes.rows.map((row: any) => ({
      hour: new Date(row.hour).toISOString(),
      avg_ping: parseFloat(Number(row.avg_packet_loss || 0).toFixed(2))
    }))

    // Get last ping timestamp for this server to show "Analysis running" status
    const lastPingRes = await client.query(`
      SELECT MAX(created_at) as last_updated
      FROM test_results_direct_ping
      WHERE downstream_server_id = $1
    `, [parseInt(serverId)])
    const lastUpdated = lastPingRes.rows[0]?.last_updated

    // Calculate overall stats
    const latencyStats = {
      avg: latencyData.length > 0 ? (latencyData.reduce((sum: number, d: any) => sum + d.avg_ping, 0) / latencyData.length).toFixed(2) : '0',
      min: latencyData.length > 0 ? Math.min(...latencyData.map((d: any) => d.avg_ping)).toFixed(2) : '0',
      max: latencyData.length > 0 ? Math.max(...latencyData.map((d: any) => d.avg_ping)).toFixed(2) : '0'
    }

    const packetLossStats = {
      avg: packetLossData.length > 0 ? (packetLossData.reduce((sum: number, d: any) => sum + d.avg_ping, 0) / packetLossData.length).toFixed(2) : '0',
      min: packetLossData.length > 0 ? Math.min(...packetLossData.map((d: any) => d.avg_ping)).toFixed(2) : '0',
      max: packetLossData.length > 0 ? Math.max(...packetLossData.map((d: any) => d.avg_ping)).toFixed(2) : '0'
    }

    return NextResponse.json({
      latencyData,
      packetLossData,
      latencyStats,
      packetLossStats,
      lastUpdated: lastUpdated ? new Date(lastUpdated).toISOString() : null
    })
  } catch (error) {
    console.error('Error fetching downstream trend data:', error)
    return NextResponse.json(
      { latencyData: [], packetLossData: [], latencyStats: { avg: '0', min: '0', max: '0' }, packetLossStats: { avg: '0', min: '0', max: '0' }, error: 'Failed to fetch downstream trend data' },
      { status: 200 }
    )
  } finally {
    if (client) client.release()
  }
}
