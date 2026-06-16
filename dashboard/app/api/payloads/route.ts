import { NextResponse } from 'next/server'
import pool from '@/lib/db'
// GET - Retrieve all payloads
export async function GET() {
  let client
  try {
    client = await pool.connect()
    
    const res = await client.query(
      'SELECT id, name, method, endpoint, parameters, headers, description, created_at FROM payloads ORDER BY created_at DESC'
    )
    
    return NextResponse.json(res.rows)
  } catch (error) {
    console.error('Payloads API error:', error)
    return NextResponse.json([])
  } finally {
    if (client) client.release()
  }
}

// POST - Create new payload
export async function POST(request: Request) {
  let client
  try {
    const body = await request.json()
    const { name, method, endpoint, parameters, headers, description } = body
    
    client = await pool.connect()
    
    await client.query(
      'INSERT INTO payloads (name, method, endpoint, parameters, headers, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [name, method, endpoint, JSON.stringify(parameters), JSON.stringify(headers), description]
    )
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Payloads API error:', error)
    return NextResponse.json({ error: 'Failed to create payload' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}

// DELETE - Delete payload
export async function DELETE(request: Request) {
  let client
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }
    
    client = await pool.connect()
    
    await client.query('DELETE FROM payloads WHERE id = $1', [id])
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Payloads API error:', error)
    return NextResponse.json({ error: 'Failed to delete payload' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}

// PUT - Update payload
export async function PUT(request: Request) {
  let client
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }
    
    const body = await request.json()
    const { name, method, endpoint, parameters, headers, description } = body
    
    client = await pool.connect()
    
    await client.query(
      'UPDATE payloads SET name = $1, method = $2, endpoint = $3, parameters = $4, headers = $5, description = $6 WHERE id = $7',
      [name, method, endpoint, JSON.stringify(parameters), JSON.stringify(headers), description, id]
    )
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Payloads API error:', error)
    return NextResponse.json({ error: 'Failed to update payload' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}
