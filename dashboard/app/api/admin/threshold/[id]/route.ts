import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const client = await pool.connect()
    const result = await client.query('SELECT * FROM threshold_master WHERE id = $1', [params.id])
    client.release()
    if (result.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(result.rows[0])
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { category, alarm_name, profile, brand, ont_type, threshold_type, warning_value, critical_value, unit, status, effective_date } = body

    const client = await pool.connect()
    const result = await client.query(
      `UPDATE threshold_master SET category = $1, alarm_name = $2, profile = $3, brand = $4, ont_type = $5, threshold_type = $6, warning_value = $7, critical_value = $8, unit = $9, status = $10, effective_date = $11, updated_by = 'admin' WHERE id = $12 RETURNING *`,
      [category, alarm_name, profile || null, brand || null, ont_type || null, threshold_type, warning_value, critical_value, unit || null, status || 'active', effective_date || new Date().toISOString().split('T')[0], params.id]
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
    await client.query('DELETE FROM threshold_master WHERE id = $1', [params.id])
    client.release()
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}