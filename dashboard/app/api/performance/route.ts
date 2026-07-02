import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { parseIds, buildOptionalFilter } from '@/lib/filter-utils'

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

    if (areaId || searchParams.get('area_ids') || regionalId || searchParams.get('regional_ids') || nopId || searchParams.get('nop_ids')) {
      joins += 'LEFT JOIN master_cluster_nop n ON n.id = d.cluster_nop_id'
    }
    const areaIdFilter = buildOptionalFilter('n.area_id', areaId, searchParams.get('area_ids'), () => pIdx++, params)
    if (areaIdFilter) conditions.push(areaIdFilter)

    const regionalIdFilter = buildOptionalFilter('d.downstream_server_id', regionalId, searchParams.get('regional_ids'), () => pIdx++, params)
    if (regionalIdFilter) conditions.push(regionalIdFilter)

    const nopIdFilter = buildOptionalFilter('d.cluster_nop_id', nopId, searchParams.get('nop_ids'), () => pIdx++, params)
    if (nopIdFilter) conditions.push(nopIdFilter)
    if (brand) { conditions.push(`d.manufacturer = $${pIdx++}`); params.push(brand) }
    if (ontType) { conditions.push(`d.cpe_type = $${pIdx++}`); params.push(ontType) }
    if (search) { conditions.push(`(d.device_name ILIKE $${pIdx} OR d.serial_number ILIKE $${pIdx})`); params.push(`%${search}%`); pIdx++ }

    const whereSQL = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : ''

    const client = await pool.connect()

    const result = await client.query(`
      SELECT
        d.id, d.device_name, d.serial_number, d.manufacturer as brand, d.cpe_type as ont_type,
        sg.name as speed_name, sg.download_threshold, sg.upload_threshold,
        p.ping_igw as latency, p.ping_ebr as latency_ebr,
        p.packet_loss_igw as packet_loss, p.created_at as ping_time,
        sd.download_speed as download, sd.created_at as download_time,
        su.upload_speed as upload, su.created_at as upload_time,
        tr.traceroute_raw, tr.total_hops, tr.created_at as traceroute_time,
        GREATEST(p.created_at, sd.created_at, su.created_at, tr.created_at) as last_test_time,
        CASE
          WHEN p.id IS NOT NULL OR sd.id IS NOT NULL OR su.id IS NOT NULL OR tr.id IS NOT NULL THEN 'completed'
          ELSE 'no_data'
        END as status
      FROM devices_ont d
      LEFT JOIN speed_group sg ON d.speed_id = sg.id
      LEFT JOIN LATERAL (
        SELECT id, ping_igw, ping_ebr, packet_loss_igw, packet_loss_ebr, executed_at, created_at
        FROM test_results_ping
        WHERE device_id = d.id
        ORDER BY created_at DESC LIMIT 1
      ) p ON true
      LEFT JOIN LATERAL (
        SELECT id, download_speed, executed_at, created_at
        FROM test_results_speed_download
        WHERE device_id = d.id
        ORDER BY created_at DESC LIMIT 1
      ) sd ON true
      LEFT JOIN LATERAL (
        SELECT id, upload_speed, executed_at, created_at
        FROM test_results_speed_upload
        WHERE device_id = d.id
        ORDER BY created_at DESC LIMIT 1
      ) su ON true
      LEFT JOIN LATERAL (
        SELECT id, traceroute_raw, total_hops, executed_at, created_at
        FROM test_results_traceroute
        WHERE device_id = d.id
        ORDER BY created_at DESC LIMIT 1
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