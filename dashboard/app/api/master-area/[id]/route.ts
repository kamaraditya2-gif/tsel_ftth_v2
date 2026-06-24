import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const client = await pool.connect()
    const result = await client.query('SELECT id, name, code, created_at FROM master_area WHERE id = $1', [params.id])
    client.release()
    if (result.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(result.rows[0])
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const { name, code } = await request.json()
    const client = await pool.connect()
    const result = await client.query(
      'UPDATE master_area SET name = $1, code = $2 WHERE id = $3 RETURNING id, name, code, created_at',
      [name, code, params.id]
    )
    client.release()
    if (result.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(result.rows[0])
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const client = await pool.connect()
    await client.query('DELETE FROM master_area WHERE id = $1', [params.id])
    client.release()
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}