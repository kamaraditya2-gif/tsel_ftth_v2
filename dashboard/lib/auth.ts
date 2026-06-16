import { cookies } from 'next/headers'
import pool from './db'

export interface User {
  id: number
  username: string
  email: string | null
  role_name?: string
}

export async function getUser(): Promise<User | null> {
  const cookieStore = await cookies()
  const session = cookieStore.get('user_session')
  
  if (!session) {
    return null
  }

  try {
    const user = JSON.parse(session.value)
    
    // Fetch user role from database
    const client = await pool.connect()
    try {
      const res = await client.query(
        'SELECT r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1',
        [user.id]
      )
      if (res.rows.length > 0) {
        user.role_name = res.rows[0].role_name
      }
    } finally {
      client.release()
    }
    
    return user
  } catch {
    return null
  }
}

export async function requireAuth(): Promise<User> {
  const user = await getUser()
  
  if (!user) {
    throw new Error('Unauthorized')
  }
  
  return user
}

export async function requireAdmin(): Promise<User> {
  const user = await getUser()
  
  if (!user) {
    throw new Error('Unauthorized')
  }
  
  const adminRoles = ['admin', 'Administrator', 'Admin']
  if (!adminRoles.includes(user.role_name || '')) {
    throw new Error('Forbidden')
  }
  
  return user
}
