import { NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import pool from '@/lib/db'
import { redis, ensureConnected } from '@/lib/redis'

const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION = 15 * 60 * 1000 // 15 minutes
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute

async function isRateLimited(identifier: string): Promise<boolean> {
  try {
    await ensureConnected()
    const key = `ratelimit:login:${identifier}`
    const now = Date.now()
    const windowStart = now - RATE_LIMIT_WINDOW
    await redis.zRemRangeByScore(key, 0, windowStart)
    const count = await redis.zCard(key)
    if (count >= MAX_ATTEMPTS) return true
    await redis.zAdd(key, { score: now, value: `${now}` })
    await redis.expire(key, 120)
    return false
  } catch { return false }
}

async function isAccountLocked(userId: number): Promise<boolean> {
  try {
    await ensureConnected()
    const key = `lockout:user:${userId}`
    const until = await redis.get(key)
    if (until && parseInt(until) > Date.now()) return true
    return false
  } catch { return false }
}

async function recordFailedAttempt(userId: number): Promise<void> {
  try {
    await ensureConnected()
    const key = `lockout:user:${userId}`
    await redis.set(key, (Date.now() + LOCKOUT_DURATION).toString(), { EX: LOCKOUT_DURATION / 1000 })
  } catch { /* ignore */ }
}

async function clearLockout(userId: number): Promise<void> {
  try {
    await ensureConnected()
    await redis.del(`lockout:user:${userId}`)
  } catch { /* ignore */ }
}

function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '')
}



export async function POST(request: Request) {
  let client
  try {
    // Get client IP for rate limiting
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown'

    // Check rate limit
    if (await isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { username, password } = body

    // Input validation and sanitization
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      )
    }

    const sanitizedUsername = sanitizeInput(username)

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

    client = await pool.connect()
    
    const res = await client.query(
      'SELECT u.id, u.username, u.password, u.email, u.is_active, r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE username = $1',
      [sanitizedUsername]
    )

    if (res.rows.length === 0) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    const user = res.rows[0]

    if (!user.is_active) {
      return NextResponse.json(
        { error: 'Account is inactive' },
        { status: 401 }
      )
    }

    // Check if account is locked
    if (await isAccountLocked(user.id)) {
      return NextResponse.json(
        { error: 'Account locked due to too many failed attempts. Please try again later.' },
        { status: 429 }
      )
    }
    
    const passwordMatch = await bcrypt.compare(password, user.password)

    if (!passwordMatch) {
      await recordFailedAttempt(user.id)
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Reset failed attempts on successful login
    await clearLockout(user.id)

    // Determine redirect based on role
    const redirectUrl = user.role_name === 'field' ? '/field' : '/'

    // Create session (simple cookie-based session)
    const response = NextResponse.json({ 
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role_name: user.role_name
      },
      redirect: redirectUrl
    })

    // Set session cookie with secure settings
    response.cookies.set('user_session', JSON.stringify({
      id: user.id,
      username: user.username,
      email: user.email
    }), {
      httpOnly: true,        // Prevent XSS access via JavaScript
      secure: false,         // HTTP for FRP tunnel (not HTTPS)
      sameSite: 'strict',    // CSRF protection
      maxAge: 60 * 60 * 8    // 8 hours session
    })

    // Set secure headers
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-XSS-Protection', '1; mode=block')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    )
  } finally {
    if (client) client.release()
  }
}
