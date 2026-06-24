import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let client
  try {
    client = await pool.connect()

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
      downstream_server_id,
      cluster_nop_id
    } = body

    const deviceId = parseInt(params.id)

    // Get manufacturer name if manufacturer_id is provided
    let manufacturerVal = null
    if (manufacturer_id) {
      const manufacturerRes = await client.query(
        'SELECT name FROM manufacturer WHERE id = $1',
        [manufacturer_id]
      )
      if (manufacturerRes.rows.length > 0) {
        manufacturerVal = manufacturerRes.rows[0].name
      }
    }

    // Get ont model name if ont_model_id is provided
    let modelVal = null
    if (ont_model_id) {
      const ontModelRes = await client.query(
        'SELECT name FROM ont_model WHERE id = $1',
        [ont_model_id]
      )
      if (ontModelRes.rows.length > 0) {
        modelVal = ontModelRes.rows[0].name
      }
    }

    // Handle empty strings as null for optional fields
    const macAddress = mac_address || null
    const ipAddress = ip_address || null
    const groupId = group_id || null
    const speedId = speed_id || null
    const indihomeId = indihome_id || null
    const cpeType = cpe_type || null
    const latVal = lat !== undefined ? (lat === '' ? null : parseFloat(lat)) : null
    const lngVal = lng !== undefined ? (lng === '' ? null : parseFloat(lng)) : null

    const dsId = downstream_server_id !== undefined ? downstream_server_id : null
    const nopId = cluster_nop_id !== undefined ? cluster_nop_id : null

    const res = await client.query(
      `UPDATE devices_ont
       SET device_name = $1, serial_number = $2, mac_address = $3, ip_address = $4,
           group_id = $5, speed_id = $6, indihome_id = $7, cpe_type = $8, manufacturer = $9,
           model = $10, status = $11, lat = $12, lng = $13, downstream_server_id = $14,
           cluster_nop_id = $15, updated_at = NOW()
       WHERE id = $16
       RETURNING id, device_name, serial_number, mac_address, ip_address,
                group_id, speed_id, indihome_id, cpe_type, manufacturer, model, status, lat, lng`,
      [device_name, serial_number, macAddress, ipAddress, groupId, speedId, indihomeId,
       cpeType, manufacturerVal, modelVal, status, latVal, lngVal, dsId, nopId, deviceId]
    )

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    }

    return NextResponse.json(res.rows[0])
  } catch (error) {
    console.error('Error updating device:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to update device', details: errorMessage }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let client
  try {
    client = await pool.connect()

    const deviceId = parseInt(params.id)

    const res = await client.query(
      'DELETE FROM devices_ont WHERE id = $1 RETURNING id',
      [deviceId]
    )

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Device deleted successfully' })
  } catch (error) {
    console.error('Error deleting device:', error)
    return NextResponse.json({ error: 'Failed to delete device' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}
