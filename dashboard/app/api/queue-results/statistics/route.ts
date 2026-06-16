import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const hours = parseInt(searchParams.get('hours') || '24')

    let client
    try {
      client = await pool.connect()
      
      // Get total statistics from queue_jobs
      const totalStats = await client.query(`
        SELECT 
          COUNT(*) as total_tests,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as success_count,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
          SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing_count,
          COUNT(DISTINCT device_id) as device_count
        FROM queue_jobs
        WHERE created_at >= NOW() - INTERVAL '${hours} hours'
      `)

      // Get test type breakdown from queue_jobs
      const typeStats = await client.query(`
        SELECT 
          test_type,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as success,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing
        FROM queue_jobs
        WHERE created_at >= NOW() - INTERVAL '${hours} hours'
          AND test_type IS NOT NULL
          AND test_type != ''
        GROUP BY test_type
        ORDER BY test_type
      `)

      // Get top 5 devices with most failures
      const topFailedDevices = await client.query(`
        SELECT 
          d.id,
          d.serial_number,
          d.indihome_id,
          gd.code as regional_code,
          COUNT(*) as total_tests,
          SUM(CASE WHEN qj.status = 'failed' THEN 1 ELSE 0 END) as failed_count
        FROM queue_jobs qj
        LEFT JOIN devices_ont d ON qj.device_id = d.id
        LEFT JOIN group_devices gd ON d.group_id = gd.id
        WHERE qj.created_at >= NOW() - INTERVAL '${hours} hours'
          AND qj.device_id IS NOT NULL
        GROUP BY d.id, d.serial_number, d.indihome_id, gd.code
        ORDER BY failed_count DESC
        LIMIT 5
      `)

      return NextResponse.json({
        total: totalStats.rows[0],
        by_type: typeStats.rows,
        top_failed_devices: topFailedDevices.rows
      })
    } finally {
      if (client) client.release()
    }
  } catch (error) {
    console.error('Error fetching queue results statistics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch queue results statistics' },
      { status: 500 }
    )
  }
}
