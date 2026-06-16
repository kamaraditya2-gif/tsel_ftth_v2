import { NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
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

// GET - Retrieve all users with roles
export async function GET() {
  let client
  try {
    client = await pool.connect()
    
    const res = await client.query(`
      SELECT u.id, u.username, u.full_name, u.email, u.is_active, u.last_login, u.created_at,
             r.name as role_name, r.description as role_description
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      ORDER BY u.id ASC
    `)
    
    const response = NextResponse.json(res.rows)
    setSecureHeaders(response)
    return response
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}

// POST - Create new user
export async function POST(request: Request) {
  let client
  try {
    const body = await request.json()
    const { username, full_name, password, email, role_id, is_active } = body

    // Input validation
    if (!username || !password || !email) {
      return NextResponse.json(
        { error: 'Username, password, and email are required' },
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

    if (password.length < 6) {
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
    
    // Check if username already exists
    const usernameCheck = await client.query(
      'SELECT id FROM users WHERE username = $1',
      [sanitizedUsername]
    )
    if (usernameCheck.rows.length > 0) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 })
    }
    
    // Check if email already exists
    const emailCheck = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [sanitizedEmail]
    )
    if (emailCheck.rows.length > 0) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 })
    }
    
    // Hash password before storing
    const hashedPassword = await bcrypt.hash(password, 10)
    
    const res = await client.query(
      'INSERT INTO users (username, full_name, password, email, role_id, is_active) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, full_name, email, role_id, is_active',
      [sanitizedUsername, sanitizedFullName, hashedPassword, sanitizedEmail, role_id, is_active]
    )
    
    const response = NextResponse.json(res.rows[0])
    setSecureHeaders(response)
    return response
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}
