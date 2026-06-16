import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid task ID' },
        { status: 400 }
      )
    }

    // Get task info to check task_type
    const taskResult = await pool.query('SELECT task_type FROM tasks WHERE id = $1', [id])
    
    if (taskResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    const taskType = taskResult.rows[0].task_type

    // Update next_run to current time and started_at if it's null
    let query
    let values

    if (taskType === 'scheduled') {
      query = `
        UPDATE tasks 
        SET next_run = NOW(), 
            started_at = COALESCE(started_at, NOW()),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `
      values = [id]
    } else if (taskType === 'ondemand') {
      // For on-demand tasks, update both started_at and next_run to NOW()
      query = `
        UPDATE tasks 
        SET started_at = NOW(),
            next_run = NOW(),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `
      values = [id]
    } else {
      // For other task types, just update next_run
      query = `
        UPDATE tasks 
        SET next_run = NOW(),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `
      values = [id]
    }

    const result = await pool.query(query, values)

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error running task:', error)
    return NextResponse.json(
      { error: 'Failed to run task' },
      { status: 500 }
    )
  }
}
