import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  try {
    const client = await pool.connect()
    const result = await client.query('SELECT id, name, code, created_at FROM master_area ORDER BY name')
    client.release()
    return NextResponse.json(result.rows)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { name, code } = await request.json()
    const client = await pool.connect()
    const result = await client.query(
      'INSERT INTO master_area (name, code) VALUES ($1, $2) RETURNING id, name, code, created_at',
      [name, code]
    )
    client.release()
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}