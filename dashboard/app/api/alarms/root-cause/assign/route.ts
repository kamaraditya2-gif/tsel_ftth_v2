import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { device_id, root_cause_id, note } = body

    if (!device_id || !root_cause_id) {
      return NextResponse.json({ error: 'device_id and root_cause_id are required' }, { status: 400 })
    }

    const client = await pool.connect()
    await client.query(
      `INSERT INTO device_alarm_root_cause (device_id, root_cause_id, root_cause_note, assigned_by, assigned_at)
       VALUES ($1, $2, $3, 'admin', NOW())
       ON CONFLICT (device_id) DO UPDATE SET
         root_cause_id = EXCLUDED.root_cause_id,
         root_cause_note = COALESCE(EXCLUDED.root_cause_note, device_alarm_root_cause.root_cause_note),
         assigned_by = 'admin',
         assigned_at = NOW()`,
      [device_id, root_cause_id, note || null]
    )
    client.release()

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Root cause assign error:', error)
    return NextResponse.json({ error: error.message || 'Failed to assign root cause' }, { status: 500 })
  }
}
