import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  let client
  try {
    client = await pool.connect()
    const body = await request.json()
    const deviceId = parseInt(params.id)

    // Dynamic UPDATE — only set fields that are provided
    const fields: string[] = []
    const values: any[] = []
    let idx = 1

    const fieldMap: Record<string, string> = {
      device_name: 'device_name',
      serial_number: 'serial_number',
      mac_address: 'mac_address',
      ip_address: 'ip_address',
      group_id: 'group_id',
      speed_id: 'speed_id',
      indihome_id: 'indihome_id',
      cpe_type: 'cpe_type',
      manufacturer: 'manufacturer',
      model: 'model',
      status: 'status',
      lat: 'lat',
      lng: 'lng',
      downstream_server_id: 'downstream_server_id',
      cluster_nop_id: 'cluster_nop_id',
      alias_device: 'alias_device',
    }

    // Resolve manufacturer name if manufacturer_id provided
    if (body.manufacturer_id) {
      const mRes = await client.query('SELECT name FROM manufacturer WHERE id = $1', [body.manufacturer_id])
      if (mRes.rows.length > 0) body.manufacturer = mRes.rows[0].name
    }
    // Resolve ont model name if ont_model_id provided
    if (body.ont_model_id) {
      const oRes = await client.query('SELECT name FROM ont_model WHERE id = $1', [body.ont_model_id])
      if (oRes.rows.length > 0) body.model = oRes.rows[0].name
    }

    for (const [key, col] of Object.entries(fieldMap)) {
      if (body[key] !== undefined) {
        let val = body[key]
        if (key === 'lat' || key === 'lng') val = val === '' ? null : parseFloat(val)
        if (['mac_address', 'ip_address', 'group_id', 'speed_id', 'indihome_id', 'cpe_type'].includes(key)) val = val || null
        if (key === 'alias_device') val = val || null
        fields.push(`${col} = $${idx++}`)
        values.push(val)
      }
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    fields.push('updated_at = NOW()')
    values.push(deviceId)

    const query = `UPDATE devices_ont SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`
    const res = await client.query(query, values)

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    }

    return NextResponse.json(res.rows[0])
  } catch (error: any) {
    console.error('Error updating device:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const client = await pool.connect()
    const res = await client.query('SELECT * FROM devices_ont WHERE id = $1', [parseInt(params.id)])
    client.release()
    if (res.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(res.rows[0])
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const client = await pool.connect()
    await client.query('DELETE FROM devices_ont WHERE id = $1', [parseInt(params.id)])
    client.release()
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}