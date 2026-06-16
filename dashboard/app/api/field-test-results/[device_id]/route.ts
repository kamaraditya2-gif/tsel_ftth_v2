import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { device_id: string } }
) {
  try {
    const deviceId = parseInt(params.device_id)
    if (isNaN(deviceId)) {
      return NextResponse.json({ error: 'Invalid device ID' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const since = searchParams.get('since') // ISO timestamp
    const includeHistorical = searchParams.get('includeHistorical') === 'true'

    // Add 30s tolerance to since so results that were queued slightly
    // before the browser clock (or across minor clock drift) are still returned.
    const sinceClause = since
      ? `AND executed_at >= ('${since}'::timestamp - INTERVAL '30 seconds')`
      : ''

    // Query for latest data (since timestamp if provided)
    const [pingLatest, tracerouteLatest, downloadLatest, uploadLatest, directPingLatest] = await Promise.all([
      pool.query(`
        SELECT ping_igw, ping_ebr, packet_loss_igw, packet_loss_ebr, success, executed_at
        FROM test_results_ping
        WHERE device_id = $1 ${sinceClause}
        ORDER BY executed_at DESC
        LIMIT 1
      `, [deviceId]),
      pool.query(`
        SELECT traceroute_raw, total_hops, total_rtt_ms, success, executed_at
        FROM test_results_traceroute
        WHERE device_id = $1 ${sinceClause}
        ORDER BY executed_at DESC
        LIMIT 1
      `, [deviceId]),
      pool.query(`
        SELECT download_speed, download_threshold, success, executed_at
        FROM test_results_speed_download
        WHERE device_id = $1 ${sinceClause}
        ORDER BY executed_at DESC
        LIMIT 1
      `, [deviceId]),
      pool.query(`
        SELECT upload_speed, upload_threshold, success, executed_at
        FROM test_results_speed_upload
        WHERE device_id = $1 ${sinceClause}
        ORDER BY executed_at DESC
        LIMIT 1
      `, [deviceId]),
      pool.query(`
        SELECT avg_latency_ms, packet_loss_percent, created_at as executed_at
        FROM test_results_direct_ping
        WHERE device_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `, [deviceId]),
    ])

    let historical = null

    // If includeHistorical flag is set and no latest data found, fetch historical
    if (includeHistorical) {
      const [pingHist, tracerouteHist, downloadHist, uploadHist] = await Promise.all([
        pool.query(`
          SELECT ping_igw, ping_ebr, packet_loss_igw, packet_loss_ebr, success, executed_at
          FROM test_results_ping
          WHERE device_id = $1
          ORDER BY executed_at DESC
          LIMIT 1
        `, [deviceId]),
        pool.query(`
          SELECT traceroute_raw, total_hops, total_rtt_ms, success, executed_at
          FROM test_results_traceroute
          WHERE device_id = $1
          ORDER BY executed_at DESC
          LIMIT 1
        `, [deviceId]),
        pool.query(`
          SELECT download_speed, download_threshold, success, executed_at
          FROM test_results_speed_download
          WHERE device_id = $1
          ORDER BY executed_at DESC
          LIMIT 1
        `, [deviceId]),
        pool.query(`
          SELECT upload_speed, upload_threshold, success, executed_at
          FROM test_results_speed_upload
          WHERE device_id = $1
          ORDER BY executed_at DESC
          LIMIT 1
        `, [deviceId]),
      ])

      historical = {
        ping: pingHist.rows[0] || null,
        traceroute: tracerouteHist.rows[0] || null,
        download: downloadHist.rows[0] || null,
        upload: uploadHist.rows[0] || null,
      }
    }

    return NextResponse.json({
      ping: pingLatest.rows[0] || null,
      traceroute: tracerouteLatest.rows[0] || null,
      download: downloadLatest.rows[0] || null,
      upload: uploadLatest.rows[0] || null,
      directPing: directPingLatest.rows[0] || null,
      historical,
      isHistorical: !since && includeHistorical,
    })
  } catch (error: any) {
    console.error('Error fetching field test results:', error)
    return NextResponse.json(
      { error: 'Failed to fetch test results', details: error.message },
      { status: 500 }
    )
  }
}
