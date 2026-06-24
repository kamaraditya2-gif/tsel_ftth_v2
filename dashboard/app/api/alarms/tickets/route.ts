import { NextResponse } from 'next/server'
import pool from '@/lib/db'

function generateTicketNumber(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const rand = String(Math.floor(1000 + Math.random() * 9000))
  return `TKT-${y}${m}${d}-${rand}`
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { device_id, summary, root_cause } = body

    if (!device_id || !summary) {
      return NextResponse.json({ error: 'device_id and summary are required' }, { status: 400 })
    }

    const ticketNumber = generateTicketNumber()

    const client = await pool.connect()
    const result = await client.query(
      `INSERT INTO alarm_tickets (device_id, ticket_number, summary, root_cause, status, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'open', 'admin', NOW(), NOW())
       RETURNING id, device_id, ticket_number, summary, root_cause, status, created_by, created_at, updated_at`,
      [device_id, ticketNumber, summary, root_cause || null]
    )
    client.release()

    return NextResponse.json({ data: result.rows[0] }, { status: 201 })
  } catch (error: any) {
    console.error('Tickets POST error:', error)
    return NextResponse.json({ error: error.message || 'Failed to create ticket' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const deviceId = searchParams.get('device_id')
  const status = searchParams.get('status')

  try {
    const client = await pool.connect()
    let query = 'SELECT * FROM alarm_tickets WHERE 1=1'
    const params: any[] = []
    let paramIdx = 1

    if (deviceId) {
      query += ` AND device_id = $${paramIdx++}`
      params.push(deviceId)
    }

    if (status) {
      query += ` AND status = $${paramIdx++}`
      params.push(status)
    }

    query += ' ORDER BY created_at DESC'

    const result = await client.query(query, params)
    client.release()

    return NextResponse.json({ data: result.rows })
  } catch (error: any) {
    console.error('Tickets GET error:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch tickets' }, { status: 500 })
  }
}
