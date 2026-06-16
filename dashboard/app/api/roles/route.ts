import { NextResponse } from 'next/server'
import pool from '@/lib/db'
function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '')
}

function setSecureHeaders(response: NextResponse): void {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
}

// GET - Retrieve all roles
export async function GET() {
  let client
  try {
    client = await pool.connect()
    
    const res = await client.query(
      'SELECT id, name, description FROM roles ORDER BY id ASC'
    )
    
    const response = NextResponse.json(res.rows)
    setSecureHeaders(response)
    return response
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}

// PUT - Update a role
export async function PUT(request: Request) {
  let client
  try {
    const { id, name, description } = await request.json()
    
    if (!id || !name) {
      return NextResponse.json({ error: 'ID and name are required' }, { status: 400 })
    }

    const sanitizedName = sanitizeInput(name)
    const sanitizedDescription = sanitizeInput(description || '')

    if (sanitizedName.length < 2 || sanitizedName.length > 50) {
      return NextResponse.json(
        { error: 'Name must be between 2 and 50 characters' },
        { status: 400 }
      )
    }

    client = await pool.connect()
    
    const res = await client.query(
      'UPDATE roles SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [sanitizedName, sanitizedDescription, id]
    )
    
    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }
    
    const response = NextResponse.json(res.rows[0])
    setSecureHeaders(response)
    return response
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}

// DELETE - Delete a role
export async function DELETE(request: Request) {
  let client
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    client = await pool.connect()
    
    // Check if role is being used by users
    const userCheck = await client.query(
      'SELECT COUNT(*) FROM users WHERE role_id = $1',
      [id]
    )
    
    if (parseInt(userCheck.rows[0].count) > 0) {
      return NextResponse.json({ error: 'Cannot delete role that is assigned to users' }, { status: 400 })
    }
    
    const res = await client.query(
      'DELETE FROM roles WHERE id = $1 RETURNING *',
      [id]
    )
    
    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }
    
    const response = NextResponse.json({ success: true })
    setSecureHeaders(response)
    return response
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete role' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}

