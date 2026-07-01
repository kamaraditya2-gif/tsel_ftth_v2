import { NextRequest, NextResponse } from 'next/server'
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

// Calculate next run from cron time (custom implementation without node-cron)
function calculateNextRun(cronTime: string): Date {
  const now = new Date()
  const jakartaOffset = 7 * 60 // Jakarta is UTC+7 (420 minutes)
  const localOffset = now.getTimezoneOffset()
  const jakartaTime = new Date(now.getTime() + (jakartaOffset + localOffset) * 60000)

  const parts = cronTime.split(' ')
  const minute = parseInt(parts[0])
  const hour = parseInt(parts[1])
  const dayOfMonth = parts[2]
  const month = parts[3]
  const dayOfWeek = parts[4]

  const nextRun = new Date(jakartaTime)

  if (dayOfMonth === '*' && dayOfWeek === '*') {
    // Minute-based interval (e.g., */15 * * * *)
    if (parts[0].startsWith('*/') && parts[1] === '*') {
      const interval = parseInt(parts[0].substring(2))
      nextRun.setMinutes(Math.ceil(nextRun.getMinutes() / interval) * interval)
      nextRun.setSeconds(0)
      nextRun.setMilliseconds(0)
      if (nextRun <= jakartaTime) {
        nextRun.setMinutes(nextRun.getMinutes() + interval)
      }
    // Hourly or daily intervals
    } else if (parts[1].startsWith('*/')) {
      // Every N hours - preserve current minute
      const interval = parseInt(parts[1].substring(2))
      nextRun.setHours(nextRun.getHours() + interval)
      nextRun.setSeconds(0)
      nextRun.setMilliseconds(0)
    } else if (parts[1] === '*') {
      // Every hour - preserve current minute
      nextRun.setHours(nextRun.getHours() + 1)
      nextRun.setSeconds(0)
      nextRun.setMilliseconds(0)
    } else {
      // Specific hour - use cron minute
      nextRun.setHours(hour)
      nextRun.setMinutes(minute)
      nextRun.setSeconds(0)
      nextRun.setMilliseconds(0)
      if (nextRun <= jakartaTime) {
        nextRun.setDate(nextRun.getDate() + 1)
      }
    }
  } else if (dayOfMonth !== '*' && dayOfWeek === '*') {
    // Specific day of month
    nextRun.setDate(parseInt(dayOfMonth))
    nextRun.setHours(hour)
    nextRun.setMinutes(minute)
    nextRun.setSeconds(0)
    nextRun.setMilliseconds(0)
    if (nextRun <= jakartaTime) {
      nextRun.setMonth(nextRun.getMonth() + 1)
    }
  } else if (dayOfMonth === '*' && dayOfWeek !== '*') {
    // Specific day of week
    const targetDay = parseInt(dayOfWeek)
    const currentDay = nextRun.getDay()
    const daysUntilTarget = (targetDay - currentDay + 7) % 7
    nextRun.setDate(nextRun.getDate() + daysUntilTarget)
    nextRun.setHours(hour)
    nextRun.setMinutes(minute)
    nextRun.setSeconds(0)
    nextRun.setMilliseconds(0)
    if (daysUntilTarget === 0 && nextRun <= jakartaTime) {
      nextRun.setDate(nextRun.getDate() + 7)
    }
  }

  return nextRun
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const taskType = sanitizeInput(searchParams.get('task_type') || '')
    const offset = (page - 1) * limit

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters' },
        { status: 400 }
      )
    }

    let query = `
      SELECT 
        t.id,
        t.title,
        t.task_type,
        t.test_type,
        t.group_id,
        t.device_id,
        t.started_at,
        t.next_run,
        t.cron_time,
        t.nop_city, t.is_active,
        t.created_at,
        t.updated_at,
        COALESCE(ds.name, g.name) as group_name,
        g.code as group_code,
        d.serial_number as device_serial,
        d.indihome_id as device_indihome,
        COALESCE(jc.completed_count, 0) as completed_count,
        COALESCE(jc.failed_count, 0) as failed_count,
        COALESCE(jc.total_count, 0) as total_count,
        CASE WHEN t.device_id IS NOT NULL THEN 1 ELSE COALESCE(dc.device_count, 0) END as device_count
      FROM tasks t
      LEFT JOIN downstream_servers ds ON t.group_id = ds.id
      LEFT JOIN group_devices g ON t.group_id = g.id
      LEFT JOIN devices_ont d ON t.device_id = d.id
      LEFT JOIN (
        SELECT 
          task_id,
          COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
          COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
          COUNT(*) as total_count
        FROM queue_jobs
        GROUP BY task_id
      ) jc ON t.id = jc.task_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*) as device_count FROM devices_ont do2
        WHERE do2.downstream_server_id = t.group_id
          AND (t.nop_city IS NULL OR t.nop_city = '' OR t.nop_city !~ '^\d+$' OR do2.cluster_nop_id = t.nop_city::INTEGER)
      ) dc ON true
    `

    let countQuery = `SELECT COUNT(*) as total FROM tasks t`
    const params: any[] = []
    const countParams: any[] = []

    if (taskType) {
      query += ` WHERE t.task_type = $${params.length + 1} AND t.deleted_at IS NULL`
      countQuery += ` WHERE t.task_type = $${countParams.length + 1} AND t.deleted_at IS NULL`
      params.push(taskType)
      countParams.push(taskType)
    } else {
      query += ` WHERE t.deleted_at IS NULL`
      countQuery += ` WHERE t.deleted_at IS NULL`
    }

    query += ` ORDER BY t.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(limit, offset)

    const [result, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, countParams)
    ])

    const total = parseInt(countResult.rows[0].total)

    const response = NextResponse.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
    setSecureHeaders(response)
    return response
  } catch (error: any) {
    console.error('Error fetching tasks:', error)
    console.error('Error details:', error.message, error.stack)
    return NextResponse.json(
      { error: 'Failed to fetch tasks', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, task_type, test_type, group_id, device_id, payload_id, cron_time, started_at, next_run, nop_city } = body

    // Input validation
    if (!title || !task_type) {
      return NextResponse.json(
        { error: 'Title and task_type are required' },
        { status: 400 }
      )
    }

    const sanitizedTitle = sanitizeInput(title)
    const sanitizedTaskType = sanitizeInput(task_type)
    const sanitizedTestType = sanitizeInput(test_type || '')
    const sanitizedCronTime = sanitizeInput(cron_time || '')

    if (sanitizedTitle.length < 1 || sanitizedTitle.length > 255) {
      return NextResponse.json(
        { error: 'Title must be between 1 and 255 characters' },
        { status: 400 }
      )
    }

    if (!['scheduled', 'ondemand'].includes(sanitizedTaskType)) {
      return NextResponse.json(
        { error: 'Invalid task_type. Must be "scheduled" or "ondemand"' },
        { status: 400 }
      )
    }

    // Set started_at and next_run based on task_type
    let startedAt = null
    let nextRun = null

    if (sanitizedTaskType === 'scheduled') {
      if (!sanitizedCronTime) {
        return NextResponse.json(
          { error: 'cron_time is required for scheduled tasks' },
          { status: 400 }
        )
      }
      // Use provided started_at as next_run for first run if provided
      if (started_at) {
        startedAt = started_at
        nextRun = started_at
      } else {
        nextRun = calculateNextRun(sanitizedCronTime)
        startedAt = nextRun
      }
    } else if (sanitizedTaskType === 'ondemand') {
      startedAt = started_at || new Date().toISOString()
      nextRun = next_run || new Date().toISOString()
    }

    // Check which columns exist
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tasks' AND column_name IN ('started_at', 'next_run')
    `)
    const existingColumns = columnCheck.rows.map(row => row.column_name)
    const hasStartedAt = existingColumns.includes('started_at')
    const hasNextRun = existingColumns.includes('next_run')

    // Build dynamic query based on existing columns
    const columns = ['title', 'task_type', 'test_type', 'group_id', 'device_id', 'cron_time', 'nop_city']
    const values = [sanitizedTitle, sanitizedTaskType, sanitizedTestType, group_id || null, device_id || null, sanitizedCronTime || null, body.nop_city || null]
    let paramIndex = 8

    if (hasStartedAt) {
      columns.push('started_at')
      values.push(startedAt)
      paramIndex++
    }

    if (hasNextRun) {
      columns.push('next_run')
      values.push(nextRun)
      paramIndex++
    }

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ')
    const query = `
      INSERT INTO tasks (${columns.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `

    const result = await pool.query(query, values)

    const response = NextResponse.json(result.rows[0], { status: 201 })
    setSecureHeaders(response)
    return response
  } catch (error: any) {
    console.error('Error creating task:', error)
    console.error('Error details:', error.message, error.stack)
    return NextResponse.json(
      { error: 'Failed to create task', details: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { title, test_type, cron_time, is_active, group_id, nop_city } = body

    // Input validation
    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

    const sanitizedTitle = sanitizeInput(title)
    const sanitizedTestType = sanitizeInput(test_type || '')
    const sanitizedCronTime = sanitizeInput(cron_time || '')

    if (sanitizedTitle.length < 1 || sanitizedTitle.length > 255) {
      return NextResponse.json(
        { error: 'Title must be between 1 and 255 characters' },
        { status: 400 }
      )
    }

    // Get current task to check task_type and original started_at
    const currentTask = await pool.query('SELECT task_type, started_at FROM tasks WHERE id = $1 AND deleted_at IS NULL', [id])
    
    if (currentTask.rows.length === 0) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    const taskType = currentTask.rows[0].task_type
    const originalStartedAt = currentTask.rows[0].started_at

    // Set started_at and next_run based on task_type
    let startedAt = null
    let nextRun = null

    if (taskType === 'scheduled') {
      if (!sanitizedCronTime) {
        return NextResponse.json(
          { error: 'cron_time is required for scheduled tasks' },
          { status: 400 }
        )
      }
      // Keep original started_at, calculate new next_run from cron_time
      startedAt = originalStartedAt
      nextRun = calculateNextRun(sanitizedCronTime)
    } else if (taskType === 'ondemand') {
      startedAt = null
      nextRun = null
    }

    // Check which columns exist
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tasks' AND column_name IN ('started_at', 'next_run')
    `)
    const existingColumns = columnCheck.rows.map(row => row.column_name)
    const hasStartedAt = existingColumns.includes('started_at')
    const hasNextRun = existingColumns.includes('next_run')

    // Build dynamic query based on existing columns
    const setColumns = ['title = $1', 'test_type = $2', 'cron_time = $3', 'is_active = $4', 'group_id = $5', 'nop_city = $6', 'updated_at = NOW()']
    const values = [sanitizedTitle, sanitizedTestType, sanitizedCronTime || null, is_active !== undefined ? is_active : true, group_id || null, nop_city || null]
    let paramIndex = 7

    if (hasStartedAt) {
      setColumns.push(`started_at = $${paramIndex}`)
      values.push(startedAt)
      paramIndex++
    }

    if (hasNextRun) {
      setColumns.push(`next_run = $${paramIndex}`)
      values.push(nextRun)
      paramIndex++
    }

    values.push(id)

    const query = `
      UPDATE tasks 
      SET ${setColumns.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `

    const result = await pool.query(query, values)

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    const response = NextResponse.json(result.rows[0])
    setSecureHeaders(response)
    return response
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      )
    }

    // Validate ID is a number
    if (isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: 'Invalid Task ID' },
        { status: 400 }
      )
    }

    // Soft delete: set deleted_at instead of actually deleting
    const query = 'UPDATE tasks SET deleted_at = NOW() WHERE id = $1 RETURNING *'
    const result = await pool.query(query, [id])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    const response = NextResponse.json({ message: 'Task deleted successfully' })
    setSecureHeaders(response)
    return response
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    )
  }
}
