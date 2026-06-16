import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lat = parseFloat(searchParams.get('lat') || '')
    const lng = parseFloat(searchParams.get('lng') || '')

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { error: 'lat and lng query parameters are required' },
        { status: 400 }
      )
    }

    const query = `
      SELECT 
        d.id,
        d.device_name,
        d.serial_number,
        d.indihome_id,
        d.cpe_type,
        d.manufacturer,
        d.model,
        d.lat,
        d.lng,
        gd.name as regional_name,
        gd.code as regional_code,
        sg.name as speed_name,
        sg.speed_limit,
        (
          6371 * acos(
            LEAST(1, GREATEST(-1,
              cos(radians($1)) * cos(radians(d.lat)) * cos(radians(d.lng) - radians($2)) +
              sin(radians($1)) * sin(radians(d.lat))
            ))
          )
        ) AS distance_km
      FROM devices_ont d
      LEFT JOIN group_devices gd ON gd.id = d.group_id
      LEFT JOIN speed_group sg ON sg.id = d.speed_id
      WHERE d.lat IS NOT NULL AND d.lng IS NOT NULL
      ORDER BY distance_km
      LIMIT 1
    `

    const result = await pool.query(query, [lat, lng])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'No ONT devices with location data found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ device: result.rows[0] })
  } catch (error: any) {
    console.error('Error finding nearest device:', error)
    return NextResponse.json(
      { error: 'Failed to find nearest device', details: error.message },
      { status: 500 }
    )
  }
}
