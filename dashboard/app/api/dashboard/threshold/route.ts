import { NextResponse } from 'next/server'
import pool from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  let client
  try {
    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('timeRange') || '24h'
    const areaId = searchParams.get('areaId')
    const regionalId = searchParams.get('regionalId')
    const nopId = searchParams.get('nopId')
    const speedGroupId = searchParams.get('speedGroupId')

    // Map timeRange to PostgreSQL interval
    const intervalMap: Record<string, string> = {
      '1h': '1 hour',
      '6h': '6 hours',
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days'
    }
    const interval = intervalMap[timeRange] || '24 hours'

    // Build WHERE clause for filters
    const filterConditions: string[] = []
    const filterParams: any[] = []
    let paramIndex = 1

    if (areaId) {
      filterConditions.push(`d.cluster_nop_id IN (SELECT id FROM master_cluster_nop WHERE area_id = $${paramIndex})`)
      filterParams.push(parseInt(areaId))
      paramIndex++
    }

    if (regionalId) {
      filterConditions.push(`d.downstream_server_id = $${paramIndex}`)
      filterParams.push(parseInt(regionalId))
      paramIndex++
    }

    if (nopId) {
      filterConditions.push(`d.cluster_nop_id = $${paramIndex}`)
      filterParams.push(parseInt(nopId))
      paramIndex++
    }

    if (speedGroupId) {
      filterConditions.push(`d.speed_id = $${paramIndex}`)
      filterParams.push(parseInt(speedGroupId))
      paramIndex++
    }

    const whereClause = filterConditions.length > 0 ? `AND ${filterConditions.join(' AND ')}` : ''

    client = await pool.connect()

    // Query for upload threshold comparison
    const uploadQuery = `
      SELECT 
        COUNT(CASE WHEN trsu.upload_speed >= sg.upload_threshold THEN 1 END) as above_threshold,
        COUNT(CASE WHEN trsu.upload_speed < sg.upload_threshold THEN 1 END) as below_threshold
      FROM devices_ont d
      LEFT JOIN speed_group sg ON d.speed_id = sg.id
      LEFT JOIN LATERAL (
        SELECT upload_speed
        FROM test_results_speed_upload
        WHERE device_id = d.id
        AND created_at >= NOW() - INTERVAL '${interval}'
        ORDER BY created_at DESC
        LIMIT 1
      ) trsu ON true
      WHERE sg.upload_threshold IS NOT NULL
      ${whereClause}
    `

    const uploadResult = await client.query(uploadQuery, filterParams)

    // Query for download threshold comparison
    const downloadQuery = `
      SELECT 
        COUNT(CASE WHEN trsd.download_speed >= sg.download_threshold THEN 1 END) as above_threshold,
        COUNT(CASE WHEN trsd.download_speed < sg.download_threshold THEN 1 END) as below_threshold
      FROM devices_ont d
      LEFT JOIN speed_group sg ON d.speed_id = sg.id
      LEFT JOIN LATERAL (
        SELECT download_speed
        FROM test_results_speed_download
        WHERE device_id = d.id
        AND created_at >= NOW() - INTERVAL '${interval}'
        ORDER BY created_at DESC
        LIMIT 1
      ) trsd ON true
      WHERE sg.download_threshold IS NOT NULL
      ${whereClause}
    `

    const downloadResult = await client.query(downloadQuery, filterParams)

    const data = {
      upload: {
        above_threshold: parseInt(uploadResult.rows[0]?.above_threshold || '0'),
        below_threshold: parseInt(uploadResult.rows[0]?.below_threshold || '0')
      },
      download: {
        above_threshold: parseInt(downloadResult.rows[0]?.above_threshold || '0'),
        below_threshold: parseInt(downloadResult.rows[0]?.below_threshold || '0')
      }
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching threshold data:', error)
    return NextResponse.json(
      {
        upload: { above_threshold: 0, below_threshold: 0 },
        download: { above_threshold: 0, below_threshold: 0 }
      },
      { status: 200 }
    )
  } finally {
    if (client) client.release()
  }
}
