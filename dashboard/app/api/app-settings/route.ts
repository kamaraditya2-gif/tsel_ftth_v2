import { NextResponse } from 'next/server'
import pool from '@/lib/db'
// GET - Retrieve app settings
export async function GET() {
  let client
  try {
    client = await pool.connect()
    
    const res = await client.query(
      'SELECT id, app_name, logo_url, favicon_url, created_at, updated_at FROM app_settings ORDER BY id ASC LIMIT 1'
    )
    
    if (res.rows.length === 0) {
      return NextResponse.json({
        app_name: 'Network Performance',
        logo_url: null,
        favicon_url: null
      })
    }
    
    return NextResponse.json(res.rows[0])
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch app settings' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}

// POST - Update app settings
export async function POST(request: Request) {
  let client
  try {
    const body = await request.json()
    const { app_name, logo_url, favicon_url } = body
    
    client = await pool.connect()
    
    // Always update the first row (id = 1)
    await client.query(
      'UPDATE app_settings SET app_name = $1, logo_url = $2, favicon_url = $3, updated_at = NOW() WHERE id = 1',
      [app_name, logo_url, favicon_url]
    )
    
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update app settings' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}
