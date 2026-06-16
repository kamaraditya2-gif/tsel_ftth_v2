import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { redis, ensureConnected } from '@/lib/redis'

export async function DELETE(request: NextRequest) {
  try {
    // Delete from database
    const query = `DELETE FROM queue_jobs`
    const result = await pool.query(query)
    
    // Delete from Redis (BullMQ queue jobs)
    try {
      await ensureConnected()
      
      // Get all queue job keys from Redis
      const keys = await redis.keys('bull:queue:jobs:*')
      
      if (keys.length > 0) {
        // Delete all queue job keys
        await redis.del(keys)
      }
      
      // Also clear the BullMQ queue itself
      await redis.del('bull:queue:jobs')
      await redis.del('bull:queue:jobs:waiting')
      await redis.del('bull:queue:jobs:active')
      await redis.del('bull:queue:jobs:completed')
      await redis.del('bull:queue:jobs:failed')
      await redis.del('bull:queue:jobs:delayed')
      await redis.del('bull:queue:jobs:paused')
      await redis.del('bull:queue:jobs:repeat')
      await redis.del('bull:queue:jobs:id')
      
    } catch (redisError) {
      console.error('Error deleting from Redis:', redisError)
      // Continue even if Redis deletion fails
    }
    
    return NextResponse.json(
      { message: 'All queue jobs deleted successfully', deletedCount: result.rowCount },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error deleting queue jobs:', error)
    return NextResponse.json(
      { error: 'Failed to delete queue jobs' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const taskId = searchParams.get('task_id')
    const groupId = searchParams.get('group_id')
    const deviceId = searchParams.get('device_id')
    const status = searchParams.get('status')
    const offset = (page - 1) * limit

    let query = `
      SELECT 
        qj.id,
        qj.task_id,
        t.title as task_title,
        qj.device_id,
        d.serial_number,
        d.indihome_id,
        gd.id as group_id,
        gd.code as regional_code, ds.name as region_name,
        qj.execution_type,
        qj.test_type,
        qj.status,
        qj.retry_count,
        qj.last_error,
        qj.raw_response,
        qj.created_at
      FROM queue_jobs qj
      LEFT JOIN tasks t ON qj.task_id = t.id
      LEFT JOIN devices_ont d ON qj.device_id = d.id
      LEFT JOIN group_devices gd ON d.group_id = gd.id
      LEFT JOIN downstream_servers ds ON d.downstream_server_id = ds.id
    `

    let countQuery = `SELECT COUNT(*) as total FROM queue_jobs qj`
    const params: any[] = []
    const countParams: any[] = []
    const conditions: string[] = []

    if (taskId) {
      conditions.push(`qj.task_id = $${params.length + 1}`)
      params.push(taskId)
      countParams.push(taskId)
    }

    if (groupId) {
      conditions.push(`d.group_id = $${params.length + 1}`)
      params.push(groupId)
      countParams.push(groupId)
      // Add joins to countQuery if filtering by group_id
      countQuery = `SELECT COUNT(*) as total FROM queue_jobs qj LEFT JOIN devices_ont d ON qj.device_id = d.id`
    }

    if (deviceId) {
      conditions.push(`qj.device_id = $${params.length + 1}`)
      params.push(deviceId)
      countParams.push(deviceId)
      // Add joins to countQuery if filtering by device_id
      countQuery = `SELECT COUNT(*) as total FROM queue_jobs qj LEFT JOIN devices_ont d ON qj.device_id = d.id`
    }

    if (status) {
      conditions.push(`qj.status = $${params.length + 1}`)
      params.push(status)
      countParams.push(status)
    }

    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ')
      query += whereClause
      countQuery += whereClause
    }

    query += ` ORDER BY qj.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(limit, offset)

    const [result, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, countParams)
    ])

    const total = parseInt(countResult.rows[0].total)
    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    })
  } catch (error) {
    console.error('Error fetching queue jobs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch queue jobs' },
      { status: 500 }
    )
  }
}
