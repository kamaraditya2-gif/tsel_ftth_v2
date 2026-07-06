import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { cookies } from 'next/headers'
export async function GET() {
  const cookieStore = await cookies()
  const session = cookieStore.get('user_session')
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const user = JSON.parse(session.value)
    
    const client = await pool.connect()
    try {
      const res = await client.query(
        'SELECT u.username, u.full_name, r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1',
        [user.id]
      )
      
      if (res.rows.length > 0) {
        const row = res.rows[0]
        return NextResponse.json({ role_name: row.role_name, username: row.username, full_name: row.full_name })
      }
      
      return NextResponse.json({ role_name: null, username: null, full_name: null })
    } finally {
      client.release()
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch user role' }, { status: 500 })
  }
}
