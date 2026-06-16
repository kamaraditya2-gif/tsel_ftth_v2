import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import bcrypt from 'bcrypt'

function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '')
}

function setSecureHeaders(response: NextResponse): void {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
}

// PUT - Update user
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  let client
  try {
    const body = await request.json()
    const { username, full_name, password, email, role_id, is_active } = body
    const userId = params.id

    // Input validation
    if (!username || !email) {
      return NextResponse.json(
        { error: 'Username and email are required' },
        { status: 400 }
      )
    }

    const sanitizedUsername = sanitizeInput(username)
    const sanitizedFullName = sanitizeInput(full_name || '')
    const sanitizedEmail = sanitizeInput(email)

    if (sanitizedUsername.length < 3 || sanitizedUsername.length > 50) {
      return NextResponse.json(
        { error: 'Username must be between 3 and 50 characters' },
        { status: 400 }
      )
    }

    if (password && password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    if (!sanitizedEmail.includes('@') || sanitizedEmail.length > 100) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }
    
    client = await pool.connect()
    
    // Check if username already exists (excluding current user)
    const usernameCheck = await client.query(
      'SELECT id FROM users WHERE username = $1 AND id != $2',
      [sanitizedUsername, userId]
    )
    if (usernameCheck.rows.length > 0) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 })
    }
    
    // Check if email already exists (excluding current user)
    const emailCheck = await client.query(
      'SELECT id FROM users WHERE email = $1 AND id != $2',
      [sanitizedEmail, userId]
    )
    if (emailCheck.rows.length > 0) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 })
    }
    
    // Build dynamic query based on whether password is provided
    let query, values
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10)
      query = 'UPDATE users SET username = $1, full_name = $2, password = $3, email = $4, role_id = $5, is_active = $6, updated_at = NOW() WHERE id = $7 RETURNING id, username, full_name, email, role_id, is_active'
      values = [sanitizedUsername, sanitizedFullName, hashedPassword, sanitizedEmail, role_id, is_active, userId]
    } else {
      query = 'UPDATE users SET username = $1, full_name = $2, email = $3, role_id = $4, is_active = $5, updated_at = NOW() WHERE id = $6 RETURNING id, username, full_name, email, role_id, is_active'
      values = [sanitizedUsername, sanitizedFullName, sanitizedEmail, role_id, is_active, userId]
    }
    
    const res = await client.query(query, values)
    
    const response = NextResponse.json(res.rows[0])
    setSecureHeaders(response)
    return response
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}

// DELETE - Delete user
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  let client
  try {
    const userId = params.id
    
    client = await pool.connect()
    
    await client.query('DELETE FROM users WHERE id = $1', [userId])
    
    const response = NextResponse.json({ success: true })
    setSecureHeaders(response)
    return response
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}
