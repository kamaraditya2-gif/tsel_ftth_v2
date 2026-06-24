import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  try {
    const client = await pool.connect()
    const result = await client.query(
      'SELECT id, name, category FROM alarm_root_cause ORDER BY category, name'
    )
    client.release()
    return NextResponse.json({ data: result.rows })
  } catch (error: any) {
    console.error('Root cause GET error:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch root causes' }, { status: 500 })
  }
}
