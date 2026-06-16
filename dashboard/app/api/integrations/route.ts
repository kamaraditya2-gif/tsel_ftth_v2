import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  try {
    const client = await pool.connect()
    const result = await client.query(
      'SELECT id, platform, name, status, config, created_at, updated_at FROM integration_settings ORDER BY id'
    )
    client.release()
    return NextResponse.json({ data: result.rows })
  } catch (error: any) {
    console.error('Integration settings GET error:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch integration settings' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { platform, status, config } = body

    if (!platform || !['telegram', 'whatsapp', 'ticketing'].includes(platform)) {
      return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
    }

    const client = await pool.connect()
    await client.query(
      `UPDATE integration_settings SET status = $1, config = COALESCE($2, config), updated_at = NOW() WHERE platform = $3`,
      [status, config ? JSON.stringify(config) : null, platform]
    )
    client.release()

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Integration settings POST error:', error)
    return NextResponse.json({ error: error.message || 'Failed to update integration settings' }, { status: 500 })
  }
}
