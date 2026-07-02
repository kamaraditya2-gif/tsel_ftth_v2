import { NextResponse } from 'next/server'
import pool from '@/lib/db'
// PUT - Update speed group
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  let client
  try {
    const body = await request.json()
    const { name, speed_limit, profile, description } = body
    const id = parseInt(params.id)
    const pct: Record<string, { dl: number; ul: number }> = {
      Bronze: { dl: 20, ul: 10 }, Silver: { dl: 40, ul: 20 },
      Gold: { dl: 60, ul: 30 }, Platinum: { dl: 80, ul: 40 }
    }
    const p = profile && speed_limit ? pct[profile] : null
    const download_threshold = p ? speed_limit * p.dl / 100 : null
    const upload_threshold = p ? speed_limit * p.ul / 100 : null
    
    client = await pool.connect()
    
    const res = await client.query(
      'UPDATE speed_group SET name = $1, speed_limit = $2, profile = $3, download_threshold = $4, upload_threshold = $5, description = $6, updated_at = NOW() WHERE id = $7 RETURNING id, name, speed_limit, profile, download_threshold, upload_threshold, description',
      [name, speed_limit, profile, download_threshold, upload_threshold, description, id]
    )
    
    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Speed group not found' }, { status: 404 })
    }
    
    return NextResponse.json(res.rows[0])
  } catch (error) {
    console.error('Speed Groups API error:', error)
    return NextResponse.json({ error: 'Failed to update speed group' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}

// DELETE - Delete speed group
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  let client
  try {
    const id = parseInt(params.id)
    
    client = await pool.connect()
    
    const res = await client.query(
      'DELETE FROM speed_group WHERE id = $1 RETURNING id',
      [id]
    )
    
    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Speed group not found' }, { status: 404 })
    }
    
    return NextResponse.json({ message: 'Speed group deleted successfully' })
  } catch (error) {
    console.error('Speed Groups API error:', error)
    return NextResponse.json({ error: 'Failed to delete speed group' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}
