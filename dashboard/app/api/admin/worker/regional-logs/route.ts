import { NextResponse } from 'next/server'
import pool from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET() {
  let client
  try {
    client = await pool.connect()

    const res = await client.query(`
      SELECT
        t.device_id,
        t.ip_address,
        t.avg_latency_ms,
        t.packet_loss_percent,
        t.downstream_server_id,
        t.created_at,
        d.device_name,
        d.serial_number,
        ds.name as region_name,
        ds.province as region_province
      FROM test_results_direct_ping t
      LEFT JOIN devices_ont d ON d.id = t.device_id
      LEFT JOIN downstream_servers ds ON ds.id = t.downstream_server_id
      ORDER BY t.created_at DESC
      LIMIT 200
    `)

    const logs = res.rows.map(row => {
      const ds = row.downstream_server_id === 1 ? 'PUSAT' : `REG${row.downstream_server_id}`
      const name = row.serial_number || row.device_name || `DEV-${row.device_id}`
      const region = row.region_name || row.region_province || `Region ${row.downstream_server_id}`
      const ts = new Date(row.created_at).toLocaleString('en-US', {
        timeZone: 'Asia/Jakarta',
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      })
      const lat = row.avg_latency_ms ? `${Number(row.avg_latency_ms).toFixed(1)}ms` : '-'
      const pl = row.packet_loss_percent ? `${Number(row.packet_loss_percent).toFixed(1)}%` : '0%'
      return `[${ds}] ${name} @${region} | 📡 ping ${lat} | 📉 loss ${pl} | 🕐 ${ts} WIB`
    })

    return NextResponse.json({ logs, total: logs.length })
  } catch (error) {
    console.error('Regional logs error:', error)
    return NextResponse.json({ logs: [], total: 0 })
  } finally {
    if (client) client.release()
  }
}
