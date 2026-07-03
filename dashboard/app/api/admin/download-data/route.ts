import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'ping'
    const days = parseInt(searchParams.get('days') || '1')
    const search = searchParams.get('search') || ''
    const regionId = searchParams.get('region_id')

    if (days < 1 || days > 7) {
      return NextResponse.json({ error: 'Days must be between 1 and 7' }, { status: 400 })
    }

    const client = await pool.connect()
    let result

    const params: any[] = []
    let pIdx = 1
    let whereExtra = ''
    if (search) { whereExtra += ` AND (d.serial_number ILIKE $${pIdx} OR d.device_name ILIKE $${pIdx})`; params.push(`%${search}%`); pIdx++ }
    if (regionId) { whereExtra += ` AND d.downstream_server_id = $${pIdx}`; params.push(parseInt(regionId)); pIdx++ }

    if (type === 'ping') {
      const q = `
        SELECT p.id, p.device_id, d.serial_number, d.device_name, d.manufacturer, d.cpe_type,
          p.ping_igw, p.ping_ebr, p.packet_loss_igw, p.packet_loss_ebr,
          p.success, p.executed_at
        FROM test_results_ping p
        JOIN devices_ont d ON p.device_id = d.id
        WHERE p.executed_at >= NOW() - INTERVAL '${days} days' ${whereExtra}
        ORDER BY p.executed_at DESC
        LIMIT 50000
      `
      result = await client.query(q, params)
    } else if (type === 'traceroute') {
      const q = `
        SELECT t.id, t.device_id, d.serial_number, d.device_name, d.manufacturer, d.cpe_type,
          t.total_hops, t.total_rtt_ms, t.success, t.executed_at,
          t.traceroute_raw
        FROM test_results_traceroute t
        JOIN devices_ont d ON t.device_id = d.id
        WHERE t.executed_at >= NOW() - INTERVAL '${days} days' ${whereExtra}
        ORDER BY t.executed_at DESC
        LIMIT 50000
      `
      result = await client.query(q, params)
    } else {
      client.release()
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    client.release()
    return NextResponse.json({ rows: result.rows, total: result.rows.length })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
