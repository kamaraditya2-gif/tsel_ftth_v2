import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid test result ID' },
        { status: 400 }
      )
    }

    // Delete from all separate test result tables using queue_job_id
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Delete from test_results_ping
      await client.query(
        'DELETE FROM test_results_ping WHERE queue_job_id = $1',
        [id]
      )

      // Delete from test_results_traceroute
      await client.query(
        'DELETE FROM test_results_traceroute WHERE queue_job_id = $1',
        [id]
      )

      // Delete from test_results_speed_upload
      await client.query(
        'DELETE FROM test_results_speed_upload WHERE queue_job_id = $1',
        [id]
      )

      // Delete from test_results_speed_download
      await client.query(
        'DELETE FROM test_results_speed_download WHERE queue_job_id = $1',
        [id]
      )

      // Delete from queue_jobs
      const result = await client.query(
        'DELETE FROM queue_jobs WHERE id = $1 RETURNING id',
        [id]
      )

      await client.query('COMMIT')

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Test result not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        message: 'Test result deleted successfully',
        id: result.rows[0].id
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error deleting test result:', error)
    return NextResponse.json(
      { error: 'Failed to delete test result' },
      { status: 500 }
    )
  }
}
