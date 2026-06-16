import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  let client
  try {
    const body = await request.json()
    const { region_id, device_ids, group_id, manufacturer, model, ip_prefix, assign_all } = body

    if (!region_id) {
      return NextResponse.json({ error: 'region_id required' }, { status: 400 })
    }

    client = await pool.connect()
    let result

    if (assign_all) {
      result = await client.query(
        'UPDATE devices_ont SET downstream_server_id = $1, updated_at = NOW()',
        [region_id]
      )
    } else if (device_ids && device_ids.length > 0) {
      result = await client.query(
        `UPDATE devices_ont SET downstream_server_id = $1, updated_at = NOW()
         WHERE id = ANY($2::int[])`,
        [region_id, device_ids]
      )
    } else if (group_id) {
      result = await client.query(
        'UPDATE devices_ont SET downstream_server_id = $1, updated_at = NOW() WHERE group_id = $2',
        [region_id, group_id]
      )
    } else if (manufacturer) {
      result = await client.query(
        'UPDATE devices_ont SET downstream_server_id = $1, updated_at = NOW() WHERE manufacturer = $2',
        [region_id, manufacturer]
      )
    } else if (model) {
      result = await client.query(
        'UPDATE devices_ont SET downstream_server_id = $1, updated_at = NOW() WHERE model = $2',
        [region_id, model]
      )
    } else if (ip_prefix) {
      result = await client.query(
        `UPDATE devices_ont SET downstream_server_id = $1, updated_at = NOW()
         WHERE ip_address LIKE $2`,
        [region_id, ip_prefix + '%']
      )
    } else {
      return NextResponse.json({ error: 'No filter specified' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      updated: result?.rowCount || 0
    })
  } catch (error) {
    console.error('Bulk assign error:', error)
    return NextResponse.json({ error: 'Failed to bulk assign' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}
