import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const testType = searchParams.get('test_type') // 'ping', 'traceroute', 'speed_upload', 'speed_download', or 'all'

    if (!testType || !['ping', 'traceroute', 'speed_upload', 'speed_download', 'all'].includes(testType)) {
      return NextResponse.json(
        { error: 'Invalid test_type. Must be ping, traceroute, speed_upload, speed_download, or all' },
        { status: 400 }
      )
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      let deletedCount = 0

      if (testType === 'ping' || testType === 'all') {
        const result = await client.query('DELETE FROM test_results_ping RETURNING id')
        deletedCount += result.rowCount || 0
      }

      if (testType === 'traceroute' || testType === 'all') {
        const result = await client.query('DELETE FROM test_results_traceroute RETURNING id')
        deletedCount += result.rowCount || 0
      }

      if (testType === 'speed_upload' || testType === 'all') {
        const result = await client.query('DELETE FROM test_results_speed_upload RETURNING id')
        deletedCount += result.rowCount || 0
      }

      if (testType === 'speed_download' || testType === 'all') {
        const result = await client.query('DELETE FROM test_results_speed_download RETURNING id')
        deletedCount += result.rowCount || 0
      }

      await client.query('COMMIT')

      return NextResponse.json({
        message: 'Test results deleted successfully',
        deleted_count: deletedCount,
        test_type: testType
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error deleting test results:', error)
    return NextResponse.json(
      { error: 'Failed to delete test results' },
      { status: 500 }
    )
  }
}
