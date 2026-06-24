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
    const profile = searchParams.get('profile')
    const severity = searchParams.get('severity')
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    let whereClauses: string[] = ['1=1']
    const params: any[] = []
    let paramIdx = 1

    if (areaId) {
      whereClauses.push(`ma.id = $${paramIdx++}`)
      params.push(parseInt(areaId))
    }
    if (regionalId) {
      whereClauses.push(`ds.id = $${paramIdx++}`)
      params.push(parseInt(regionalId))
    }
    if (nopId) {
      whereClauses.push(`n.id = $${paramIdx++}`)
      params.push(parseInt(nopId))
    }
    if (brand) {
      whereClauses.push(`d.manufacturer = $${paramIdx++}`)
      params.push(brand)
    }
    if (ontType) {
      whereClauses.push(`d.cpe_type = $${paramIdx++}`)
      params.push(ontType)
    }
    if (severity) {
      whereClauses.push(`aa.severity = $${paramIdx++}`)
      params.push(severity)
    }
    if (status === 'active') {
      whereClauses.push('aa.cleared_at IS NULL')
    }
    if (search) {
      whereClauses.push(`(d.device_name ILIKE $${paramIdx} OR d.serial_number ILIKE $${paramIdx} OR d.manufacturer ILIKE $${paramIdx})`)
      params.push(`%${search}%`)
      paramIdx++
    }

    const whereSQL = whereClauses.join(' AND ')

    const client = await pool.connect()

    const countResult = await client.query(`
      SELECT COUNT(*) FROM active_alarms aa
      JOIN devices_ont d ON d.id = aa.device_id
      LEFT JOIN master_cluster_nop n ON n.id = d.cluster_nop_id
      LEFT JOIN downstream_servers ds ON ds.id = d.downstream_server_id
      LEFT JOIN master_area ma ON ma.id = n.area_id
      WHERE ${whereSQL}
    `, params)

    const result = await client.query(`
      SELECT aa.id as alarm_id, aa.alarm_type, aa.metric_value, aa.threshold_value,
             aa.severity, aa.message, aa.triggered_at, aa.last_checked_at,
             d.id as device_id, d.device_name, d.serial_number, d.manufacturer as brand,
             d.cpe_type as ont_type, d.ip_address, d.status as device_status,
             n.name as nop_name, ds.name as regional_name, ma.name as area_name
      FROM active_alarms aa
      JOIN devices_ont d ON d.id = aa.device_id
      LEFT JOIN master_cluster_nop n ON n.id = d.cluster_nop_id
      LEFT JOIN downstream_servers ds ON ds.id = d.downstream_server_id
      LEFT JOIN master_area ma ON ma.id = n.area_id
      WHERE ${whereSQL}
      ORDER BY aa.triggered_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `, [...params, limit, offset])

    // Get unique brand and ont_type values untuk filter
    const brandsResult = await client.query(`SELECT DISTINCT manufacturer FROM devices_ont WHERE manufacturer IS NOT NULL ORDER BY manufacturer`)
    const ontTypesResult = await client.query(`SELECT DISTINCT cpe_type FROM devices_ont WHERE cpe_type IS NOT NULL ORDER BY cpe_type`)

    client.release()

    return NextResponse.json({
      alarms: result.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit,
      filters: {
        brands: brandsResult.rows.map(r => r.manufacturer),
        ontTypes: ontTypesResult.rows.map(r => r.cpe_type),
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}