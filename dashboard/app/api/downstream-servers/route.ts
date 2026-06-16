import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET() {
  let client
  try {
    client = await pool.connect()
    const res = await client.query(
      `SELECT id, name, location, province, lat, lng, status, icon, color
       FROM downstream_servers
       ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, province, name`
    )
    return NextResponse.json({ servers: res.rows })
  } catch (error) {
    console.error('Error fetching downstream servers:', error)
    return NextResponse.json({ servers: [], error: 'Failed to fetch servers' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}

export async function POST(request: NextRequest) {
  let client
  try {
    const body = await request.json()
    client = await pool.connect()
    const res = await client.query(
      `INSERT INTO downstream_servers (name, location, province, lat, lng, status, icon, color)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [body.name, body.location || null, body.province || null, body.lat || null, body.lng || null,
       body.status || 'inactive', body.icon || 'server', body.color || '#ef4444']
    )
    return NextResponse.json(res.rows[0], { status: 201 })
  } catch (error) {
    console.error('Error creating downstream server:', error)
    return NextResponse.json({ error: 'Failed to create server' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}

export async function PUT(request: NextRequest) {
  let client
  try {
    const body = await request.json()
    client = await pool.connect()
    const res = await client.query(
      `UPDATE downstream_servers SET name=$1, location=$2, province=$3, lat=$4, lng=$5,
       status=$6, icon=$7, color=$8 WHERE id=$9 RETURNING *`,
      [body.name, body.location, body.province, body.lat, body.lng,
       body.status, body.icon, body.color, body.id]
    )
    return NextResponse.json(res.rows[0] || { error: 'Not found' })
  } catch (error) {
    console.error('Error updating downstream server:', error)
    return NextResponse.json({ error: 'Failed to update server' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}

export async function DELETE(request: NextRequest) {
  let client
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    client = await pool.connect()
    await client.query('DELETE FROM downstream_servers WHERE id=$1', [id])
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting downstream server:', error)
    return NextResponse.json({ error: 'Failed to delete server' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}
