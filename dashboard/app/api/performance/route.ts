import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const areaId = searchParams.get('area_id')
    const regionalId = searchParams.get('regional_id')
    const nopId = searchParams.get('nop_id')
    const brand = searchParams.get('brand')
    const ontType = searchParams.get('ont_type')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50')

    let joins = ''
    const conditions: string[] = []
    const params: any[] = []
    let pIdx = 1

    if (areaId || regionalId || nopId) {
      joins += 'LEFT JOIN master_cluster_nop n ON n.id = d.cluster_nop_id'
    }
    if (areaId) { conditions.push(`n.area_id = $${pIdx++}`); params.push(parseInt(areaId)) }
    if (regionalId) { conditions.push(`d.downstream_server_id = $${pIdx++}`); params.push(parseInt(regionalId)) }
    if (nopId) { conditions.push(`d.cluster_nop_id = $${pIdx++}`); params.push(parseInt(nopId)) }
    if (brand) { conditions.push(`d.manufacturer = $${pIdx++}`); params.push(brand) }
    if (ontType) { conditions.push(`d.cpe_type = $${pIdx++}`); params.push(ontType) }
    if (search) { conditions.push(`(d.device_name ILIKE $${pIdx} OR d.serial_number ILIKE $${pIdx})`); params.push(`%${search}%`); pIdx++ }

    const whereSQL = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : ''

    const client = await pool.connect()

    const result = await client.query(`
      SELECT
        d.id, d.device_name, d.serial_number, d.manufacturer as brand, d.cpe_type as ont_type,
        p.ping_igw as latency, p.ping_ebr as latency_ebr,
        p.packet_loss_igw as packet_loss, p.executed_at as ping_time,
        sd.download_speed as download, sd.executed_at as download_time,
        su.upload_speed as upload, su.executed_at as upload_time,
        tr.traceroute_raw, tr.total_hops, tr.executed_at as traceroute_time,
        GREATEST(p.executed_at, sd.executed_at, su.executed_at, tr.executed_at) as last_test_time,
        CASE
          WHEN p.id IS NOT NULL OR sd.id IS NOT NULL OR su.id IS NOT NULL OR tr.id IS NOT NULL THEN 'completed'
          ELSE 'no_data'
        END as status
      FROM devices_ont d
      LEFT JOIN LATERAL (
        SELECT id, ping_igw, ping_ebr, packet_loss_igw, packet_loss_ebr, executed_at
        FROM test_results_ping
        WHERE device_id = d.id
        ORDER BY executed_at DESC LIMIT 1
      ) p ON true
      LEFT JOIN LATERAL (
        SELECT id, download_speed, executed_at
        FROM test_results_speed_download
        WHERE device_id = d.id
        ORDER BY executed_at DESC LIMIT 1
      ) sd ON true
      LEFT JOIN LATERAL (
        SELECT id, upload_speed, executed_at
        FROM test_results_speed_upload
        WHERE device_id = d.id
        ORDER BY executed_at DESC LIMIT 1
      ) su ON true
      LEFT JOIN LATERAL (
        SELECT id, traceroute_raw, total_hops, executed_at
        FROM test_results_traceroute
        WHERE device_id = d.id
        ORDER BY executed_at DESC LIMIT 1
      ) tr ON true
      ${joins}
      WHERE (p.id IS NOT NULL OR sd.id IS NOT NULL OR su.id IS NOT NULL OR tr.id IS NOT NULL)
      ${whereSQL}
      ORDER BY last_test_time DESC NULLS LAST
      LIMIT $${pIdx}
    `, [...params, limit])

    client.release()

    return NextResponse.json({ results: result.rows })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}