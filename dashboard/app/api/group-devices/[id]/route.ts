import { NextResponse } from 'next/server'
import pool from '@/lib/db'
// PUT - Update group device
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  let client
  try {
    const body = await request.json()
    const { name, code, description } = body
    const groupId = params.id
    
    client = await pool.connect()
    
    const res = await client.query(
      'UPDATE group_devices SET name = $1, code = $2, description = $3, updated_at = NOW() WHERE id = $4 RETURNING id, name, code, description',
      [name, code, description, groupId]
    )
    
    return NextResponse.json(res.rows[0])
  } catch (error) {
    console.error('Group Devices API error:', error)
    return NextResponse.json({ error: 'Failed to update group device' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}

// DELETE - Delete group device
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  let client
  try {
    const groupId = params.id
    
    client = await pool.connect()
    
    await client.query('DELETE FROM group_devices WHERE id = $1', [groupId])
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Group Devices API error:', error)
    return NextResponse.json({ error: 'Failed to delete group device' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}
