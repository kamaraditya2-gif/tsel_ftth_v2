import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const query = `
      UPDATE queue_jobs 
      SET status = 'pending',
          retry_count = retry_count + 1,
          last_error = NULL,
          started_at = NULL,
          completed_at = NULL,
          is_retest = TRUE
      WHERE id = $1
      RETURNING *
    `
    const result = await pool.query(query, [id])

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Queue job not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { message: 'Queue job retested successfully', data: result.rows[0] },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error retesting queue job:', error)
    return NextResponse.json(
      { error: 'Failed to retest queue job' },
      { status: 500 }
    )
  }
}
