import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const status = searchParams.get('status')

    let query = 'SELECT * FROM threshold_master WHERE 1=1'
    const params: any[] = []
    let paramIndex = 1

    if (category) {
      query += ` AND category = $${paramIndex++}`
      params.push(category)
    }
    if (status) {
      query += ` AND status = $${paramIndex++}`
      params.push(status)
    }

    query += ' ORDER BY category, alarm_name'

    const client = await pool.connect()
    const result = await client.query(query, params)
    client.release()
    return NextResponse.json(result.rows)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { category, alarm_name, profile, brand, ont_type, threshold_type, warning_value, critical_value, unit, status, effective_date } = body

    const client = await pool.connect()
    const result = await client.query(
      `INSERT INTO threshold_master (category, alarm_name, profile, brand, ont_type, threshold_type, warning_value, critical_value, unit, status, effective_date, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [category, alarm_name, profile || null, brand || null, ont_type || null, threshold_type, warning_value, critical_value, unit || null, status || 'active', effective_date || new Date().toISOString().split('T')[0], 'admin']
    )
    client.release()
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}