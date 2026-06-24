import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const ticketId = parseInt(params.id)
  if (isNaN(ticketId)) {
    return NextResponse.json({ error: 'Invalid ticket ID' }, { status: 400 })
  }

  try {
    const body = await request.json()
    const { status } = body

    if (!status) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 })
    }

    const validStatuses = ['open', 'in_progress', 'resolved', 'closed']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 })
    }

    const client = await pool.connect()

    const resolvedAt = status === 'resolved' || status === 'closed' ? 'NOW()' : null
    const updateQuery = resolvedAt
      ? `UPDATE alarm_tickets SET status = $1, resolved_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *`
      : `UPDATE alarm_tickets SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`

    const result = await client.query(updateQuery, [status, ticketId])
    client.release()

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    return NextResponse.json({ data: result.rows[0] })
  } catch (error: any) {
    console.error('Ticket PUT error:', error)
    return NextResponse.json({ error: error.message || 'Failed to update ticket' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const ticketId = parseInt(params.id)
  if (isNaN(ticketId)) {
    return NextResponse.json({ error: 'Invalid ticket ID' }, { status: 400 })
  }

  try {
    const client = await pool.connect()
    const result = await client.query(
      'DELETE FROM alarm_tickets WHERE id = $1 RETURNING id',
      [ticketId]
    )
    client.release()

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: 'Ticket deleted' })
  } catch (error: any) {
    console.error('Ticket DELETE error:', error)
    return NextResponse.json({ error: error.message || 'Failed to delete ticket' }, { status: 500 })
  }
}
