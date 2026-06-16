import { NextResponse } from 'next/server'
import pool from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const cpeTypesOnly = searchParams.get('cpe_types_only') === 'true'

  let client
  try {
    client = await pool.connect()

    if (cpeTypesOnly) {
      const res = await client.query(`
        SELECT DISTINCT cpe_type
        FROM devices_ont
        WHERE cpe_type IS NOT NULL AND cpe_type != ''
        ORDER BY cpe_type
      `)
      return NextResponse.json({ cpe_types: res.rows.map(r => r.cpe_type) })
    }

    const res = await client.query(`
      SELECT 
        d.id,
        d.device_name,
        d.serial_number,
        d.mac_address,
        d.ip_address,
        d.status,
        d.group_id,
        d.speed_id,
        d.indihome_id,
        d.cpe_type,
        d.manufacturer,
        d.model,
        d.lat,
        d.lng,
        d.downstream_server_id,
        d.created_at,
        g.name as group_name,
        sg.name as speed_name,
        ds.name as region_name,
        ds.province as region_province,
        COALESCE(p.avg_ping, 0) as avg_ping
      FROM devices_ont d
      LEFT JOIN group_devices g ON d.group_id = g.id
      LEFT JOIN speed_group sg ON d.speed_id = sg.id
      LEFT JOIN downstream_servers ds ON d.downstream_server_id = ds.id
      LEFT JOIN (
        SELECT device_id, AVG(ping_igw) as avg_ping
        FROM test_results_ping
        WHERE executed_at > NOW() - INTERVAL '24 hours'
        GROUP BY device_id
      ) p ON d.id = p.device_id 
      ORDER BY d.device_name
    `)

    const devices = res.rows.map(row => ({
      id: row.id,
      device_name: row.device_name,
      serial_number: row.serial_number,
      mac_address: row.mac_address,
      ip_address: row.ip_address,
      status: row.status,
      group_id: row.group_id ? parseInt(row.group_id) : null,
      speed_id: row.speed_id ? parseInt(row.speed_id) : null,
      indihome_id: row.indihome_id,
      cpe_type: row.cpe_type,
      manufacturer: row.manufacturer,
      model: row.model,
      lat: row.lat,
      lng: row.lng,
      downstream_server_id: row.downstream_server_id ? parseInt(row.downstream_server_id) : null,
      group_name: row.group_name,
      speed_name: row.speed_name,
      region_name: row.region_name,
      region_province: row.region_province,
      avg_ping: row.avg_ping,
    }))

    return NextResponse.json(devices)
  } catch (error) {
    console.error('Devices API error:', error)
    return NextResponse.json([])
  } finally {
    if (client) client.release()
  }
}

export async function POST(request: Request) {
  let client
  try {
    const body = await request.json()
    const {
      device_name,
      serial_number,
      mac_address,
      ip_address,
      group_id,
      speed_id,
      indihome_id,
      cpe_type,
      manufacturer_id,
      ont_model_id,
      status,
      lat,
      lng,
      downstream_server_id
    } = body

    client = await pool.connect()

    // Get manufacturer name if manufacturer_id is provided
    let manufacturer = null
    if (manufacturer_id) {
      const manufacturerRes = await client.query(
        'SELECT name FROM manufacturer WHERE id = $1',
        [manufacturer_id]
      )
      if (manufacturerRes.rows.length > 0) {
        manufacturer = manufacturerRes.rows[0].name
      }
    }

    // Get ont model name if ont_model_id is provided
    let model = null
    if (ont_model_id) {
      const ontModelRes = await client.query(
        'SELECT name FROM ont_model WHERE id = $1',
        [ont_model_id]
      )
      if (ontModelRes.rows.length > 0) {
        model = ontModelRes.rows[0].name
      }
    }

    const dsId = downstream_server_id !== undefined ? downstream_server_id : null

    const res = await client.query(
      `INSERT INTO devices_ont 
        (device_name, serial_number, mac_address, ip_address, group_id, speed_id, 
         indihome_id, cpe_type, manufacturer, model, status, lat, lng, downstream_server_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
       RETURNING *`,
      [
        device_name,
        serial_number,
        mac_address || null,
        ip_address || null,
        group_id || null,
        speed_id || null,
        indihome_id || null,
        cpe_type || null,
        manufacturer,
        model,
        status || 'offline',
        lat || null,
        lng || null,
        dsId
      ]
    )

    return NextResponse.json(res.rows[0], { status: 201 })
  } catch (error) {
    console.error('Error creating device:', error)
    return NextResponse.json({ error: 'Failed to create device' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}
