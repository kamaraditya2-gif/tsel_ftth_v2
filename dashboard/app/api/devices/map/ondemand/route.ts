import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

function setSecureHeaders(response: NextResponse): void {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { deviceId } = body

    if (!deviceId || isNaN(parseInt(deviceId))) {
      return NextResponse.json({ error: 'Valid deviceId is required' }, { status: 400 })
    }

    const deviceIdNum = parseInt(deviceId)

    // Create on-demand task for ping+download+upload
    const taskRes = await pool.query(`
      INSERT INTO tasks (title, task_type, test_type, device_id, is_active, started_at, next_run, created_at)
      VALUES ($1, 'ondemand', 'ping,download,upload', $2, true, NOW(), NOW(), NOW())
      RETURNING id
    `, [`On Demand Test - Device #${deviceIdNum}`, deviceIdNum])

    const taskId = taskRes.rows[0].id

    return NextResponse.json({ taskId, deviceId: deviceIdNum, status: 'requested' }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating on-demand test:', error)
    return NextResponse.json({ error: 'Failed to create on-demand test', details: error.message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get('deviceId')

    if (!deviceId || isNaN(parseInt(deviceId))) {
      return NextResponse.json({ error: 'Valid deviceId is required' }, { status: 400 })
    }

    const deviceIdNum = parseInt(deviceId)

    // Get latest queue_jobs for this device with execution_type='ondemand'
    const jobsRes = await pool.query(`
      SELECT qj.id, qj.status, qj.execution_type, qj.test_type, qj.completed_at, qj.last_error, qj.created_at
      FROM queue_jobs qj
      WHERE qj.device_id = $1
        AND qj.execution_type = 'ondemand'
        AND qj.created_at >= NOW() - INTERVAL '5 minutes'
      ORDER BY qj.created_at DESC
      LIMIT 4
    `, [deviceIdNum])

    const jobs = jobsRes.rows
    if (jobs.length === 0) {
      return NextResponse.json({ jobs: [], hasResult: false })
    }

    // Collect queue_job IDs for querying results
    const jobIds = jobs.map(j => j.id)
    const hasCompleted = jobs.some(j => j.status === 'completed')

    if (!hasCompleted) {
      return NextResponse.json({
        jobs: jobs.map(j => ({ id: j.id, status: j.status, testType: j.test_type })),
        hasResult: false,
        overallStatus: jobs.some(j => j.status === 'failed') ? 'failed' : 'pending'
      })
    }

    // Get test results for completed jobs
    const completedJobIds = jobs.filter(j => j.status === 'completed').map(j => j.id)

    const [pingRes, dlRes, ulRes] = await Promise.all([
      pool.query(`
        SELECT ping_igw, ping_ebr, packet_loss_igw, packet_loss_ebr, success, executed_at
        FROM test_results_ping
        WHERE queue_job_id = ANY($1::uuid[])
        ORDER BY executed_at DESC
        LIMIT 1
      `, [completedJobIds]),
      pool.query(`
        SELECT download_speed, download_threshold, success, executed_at
        FROM test_results_speed_download
        WHERE queue_job_id = ANY($1::uuid[])
        ORDER BY executed_at DESC
        LIMIT 1
      `, [completedJobIds]),
      pool.query(`
        SELECT upload_speed, upload_threshold, success, executed_at
        FROM test_results_speed_upload
        WHERE queue_job_id = ANY($1::uuid[])
        ORDER BY executed_at DESC
        LIMIT 1
      `, [completedJobIds])
    ])

    const ping = pingRes.rows[0] || null
    const download = dlRes.rows[0] || null
    const upload = ulRes.rows[0] || null

    const response = NextResponse.json({
      jobs: jobs.map(j => ({ id: j.id, status: j.status, testType: j.test_type })),
      hasResult: true,
      overallStatus: 'completed',
      results: {
        ping_igw: ping?.ping_igw ?? null,
        ping_ebr: ping?.ping_ebr ?? null,
        packet_loss_igw: ping?.packet_loss_igw ?? null,
        packet_loss_ebr: ping?.packet_loss_ebr ?? null,
        download_speed: download?.download_speed ?? null,
        download_threshold: download?.download_threshold ?? null,
        upload_speed: upload?.upload_speed ?? null,
        upload_threshold: upload?.upload_threshold ?? null,
        executed_at: ping?.executed_at || download?.executed_at || upload?.executed_at || null
      }
    })
    setSecureHeaders(response)
    return response
  } catch (error: any) {
    console.error('Error fetching on-demand results:', error)
    return NextResponse.json({ error: 'Failed to fetch results', details: error.message }, { status: 500 })
  }
}
