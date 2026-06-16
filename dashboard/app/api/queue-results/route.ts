import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = (page - 1) * limit
    const deviceId = searchParams.get('device_id')
    const groupId = searchParams.get('group_id')
    const speedId = searchParams.get('speed_id')
    const hours = parseInt(searchParams.get('hours') || '0')
    const testType = searchParams.get('test_type') // 'all', 'ping', 'traceroute', 'speed', 'download', 'upload'

    let query = ``
    let countQuery = ``

    // When filtering by test type, query directly from the test_results table
    if (testType === 'ping') {
      query = `
        SELECT 
          ping.id as id,
          ping.queue_job_id,
          ping.device_id,
          d.serial_number,
          d.indihome_id,
          gd.code as regional_code, ds.name as region_name, ds.name as region_name,
          t.title as task_name,
          sg.name as speed_name, ds.name as region_name, ds.name as region_name, ds.name as region_name,
          ping.ping_igw,
          ping.ping_ebr,
          NULL as traceroute_raw,
          NULL as download_speed,
          NULL as upload_speed,
          ping.packet_loss_igw,
          ping.packet_loss_ebr,
          ping.success as success,
          NULL as error_message,
          ping.executed_at,
          NULL as test_types
        FROM test_results_ping ping
        LEFT JOIN tasks t ON ping.task_id = t.id
        LEFT JOIN devices_ont d ON ping.device_id = d.id
        LEFT JOIN group_devices gd ON d.group_id = gd.id
    LEFT JOIN downstream_servers ds ON d.downstream_server_id = ds.id
        LEFT JOIN speed_group sg ON d.speed_id = sg.id
      `
      countQuery = `
        SELECT COUNT(*) as total 
        FROM test_results_ping ping
        LEFT JOIN devices_ont d ON ping.device_id = d.id
      `
    } else if (testType === 'traceroute') {
      query = `
        SELECT 
          traceroute.id as id,
          traceroute.queue_job_id,
          traceroute.device_id,
          d.serial_number,
          d.indihome_id,
          gd.code as regional_code, ds.name as region_name, ds.name as region_name,
          t.title as task_name,
          sg.name as speed_name, ds.name as region_name, ds.name as region_name, ds.name as region_name,
          NULL as ping_igw,
          NULL as ping_ebr,
          traceroute.traceroute_raw,
          NULL as download_speed,
          NULL as upload_speed,
          NULL as packet_loss_igw,
          NULL as packet_loss_ebr,
          traceroute.success as success,
          NULL as error_message,
          traceroute.executed_at,
          NULL as test_types
        FROM test_results_traceroute traceroute
        LEFT JOIN tasks t ON traceroute.task_id = t.id
        LEFT JOIN devices_ont d ON traceroute.device_id = d.id
        LEFT JOIN group_devices gd ON d.group_id = gd.id
    LEFT JOIN downstream_servers ds ON d.downstream_server_id = ds.id
        LEFT JOIN speed_group sg ON d.speed_id = sg.id
      `
      countQuery = `
        SELECT COUNT(*) as total 
        FROM test_results_traceroute traceroute
        LEFT JOIN devices_ont d ON traceroute.device_id = d.id
      `
    } else if (testType === 'speed_upload') {
      query = `
        SELECT 
          upload.id as id,
          upload.queue_job_id,
          upload.device_id,
          d.serial_number,
          d.indihome_id,
          gd.code as regional_code, ds.name as region_name, ds.name as region_name,
          t.title as task_name,
          sg.name as speed_name, ds.name as region_name, ds.name as region_name, ds.name as region_name,
          sg.upload_threshold,
          NULL as download_threshold,
          NULL as ping_igw,
          NULL as ping_ebr,
          NULL as traceroute_raw,
          NULL as download_speed,
          upload.upload_speed,
          NULL as packet_loss_igw,
          NULL as packet_loss_ebr,
          upload.success as success,
          NULL as error_message,
          upload.executed_at,
          NULL as test_types
        FROM test_results_speed_upload upload
        LEFT JOIN tasks t ON upload.task_id = t.id
        LEFT JOIN devices_ont d ON upload.device_id = d.id
        LEFT JOIN group_devices gd ON d.group_id = gd.id
    LEFT JOIN downstream_servers ds ON d.downstream_server_id = ds.id
        LEFT JOIN speed_group sg ON d.speed_id = sg.id
      `
      countQuery = `
        SELECT COUNT(*) as total 
        FROM test_results_speed_upload upload
        LEFT JOIN devices_ont d ON upload.device_id = d.id
      `
    } else if (testType === 'speed_download') {
      query = `
        SELECT 
          download.id as id,
          download.queue_job_id,
          download.device_id,
          d.serial_number,
          d.indihome_id,
          gd.code as regional_code, ds.name as region_name, ds.name as region_name,
          t.title as task_name,
          sg.name as speed_name, ds.name as region_name, ds.name as region_name, ds.name as region_name,
          NULL as upload_threshold,
          sg.download_threshold,
          NULL as ping_igw,
          NULL as ping_ebr,
          NULL as traceroute_raw,
          download.download_speed,
          NULL as upload_speed,
          NULL as packet_loss_igw,
          NULL as packet_loss_ebr,
          download.success as success,
          NULL as error_message,
          download.executed_at,
          NULL as test_types
        FROM test_results_speed_download download
        LEFT JOIN tasks t ON download.task_id = t.id
        LEFT JOIN devices_ont d ON download.device_id = d.id
        LEFT JOIN group_devices gd ON d.group_id = gd.id
    LEFT JOIN downstream_servers ds ON d.downstream_server_id = ds.id
        LEFT JOIN speed_group sg ON d.speed_id = sg.id
      `
      countQuery = `
        SELECT COUNT(*) as total 
        FROM test_results_speed_download download
        LEFT JOIN devices_ont d ON download.device_id = d.id
      `
    } else {
      // For 'all' or no filter, use original query structure with separate speed tables
      query = `
        SELECT 
          qj.id as id,
          qj.id as queue_job_id,
          qj.device_id,
          d.serial_number,
          d.indihome_id,
          gd.code as regional_code, ds.name as region_name, ds.name as region_name,
          t.title as task_name,
          sg.name as speed_name, ds.name as region_name, ds.name as region_name, ds.name as region_name,
          ping.ping_igw,
          ping.ping_ebr,
          traceroute.traceroute_raw,
          download.download_speed,
          upload.upload_speed,
          ping.packet_loss_igw,
          ping.packet_loss_ebr,
          qj.status as success,
          NULL as error_message,
          qj.created_at as executed_at,
          NULL as test_types
        FROM queue_jobs qj
        LEFT JOIN tasks t ON qj.task_id = t.id
        LEFT JOIN devices_ont d ON qj.device_id = d.id
        LEFT JOIN group_devices gd ON d.group_id = gd.id
    LEFT JOIN downstream_servers ds ON d.downstream_server_id = ds.id
        LEFT JOIN speed_group sg ON d.speed_id = sg.id
        LEFT JOIN test_results_ping ping ON qj.id = ping.queue_job_id
        LEFT JOIN test_results_traceroute traceroute ON qj.id = traceroute.queue_job_id
        LEFT JOIN test_results_speed_download download ON qj.id = download.queue_job_id
        LEFT JOIN test_results_speed_upload upload ON qj.id = upload.queue_job_id
      `
      countQuery = `
        SELECT COUNT(*) as total FROM queue_jobs qj
        LEFT JOIN devices_ont d ON qj.device_id = d.id
        LEFT JOIN test_results_ping ping ON qj.id = ping.queue_job_id
        LEFT JOIN test_results_traceroute traceroute ON qj.id = traceroute.queue_job_id
        LEFT JOIN test_results_speed_download download ON qj.id = download.queue_job_id
        LEFT JOIN test_results_speed_upload upload ON qj.id = upload.queue_job_id
      `
    }

    const params: any[] = [limit, offset]
    const countParams: any[] = []

    if (deviceId) {
      if (testType === 'ping') {
        query += ` WHERE ping.device_id = $${params.length + 1}`
        countQuery += ` WHERE ping.device_id = $${countParams.length + 1}`
      } else if (testType === 'traceroute') {
        query += ` WHERE traceroute.device_id = $${params.length + 1}`
        countQuery += ` WHERE traceroute.device_id = $${countParams.length + 1}`
      } else if (testType === 'speed_upload') {
        query += ` WHERE upload.device_id = $${params.length + 1}`
        countQuery += ` WHERE upload.device_id = $${countParams.length + 1}`
      } else if (testType === 'speed_download') {
        query += ` WHERE download.device_id = $${params.length + 1}`
        countQuery += ` WHERE download.device_id = $${countParams.length + 1}`
      } else if (testType === 'speed') {
        query += ` WHERE speed.device_id = $${params.length + 1}`
        countQuery += ` WHERE speed.device_id = $${countParams.length + 1}`
      } else {
        query += ` WHERE qj.device_id = $${params.length + 1}`
        countQuery += ` WHERE qj.device_id = $${countParams.length + 1}`
      }
      params.push(deviceId)
      countParams.push(deviceId)
    } else if (groupId) {
      query += ` WHERE d.group_id = $${params.length + 1}`
      countQuery += ` WHERE d.group_id = $${countParams.length + 1}`
      params.push(groupId)
      countParams.push(groupId)
    } else if (speedId) {
      query += ` WHERE d.speed_id = $${params.length + 1}`
      countQuery += ` WHERE d.speed_id = $${countParams.length + 1}`
      params.push(speedId)
      countParams.push(speedId)
    }

    // Add test type filter - only needed when testType is 'all' or not specified
    // When specific test type is used, the FROM clause already handles the filtering
    if (testType && testType !== 'all') {
      // No additional filter needed - the FROM clause already selects from the specific test_results table
    }

    if (hours > 0) {
      const timeFilter = (deviceId || groupId || speedId || testType) ? ` AND` : ` WHERE`
      if (testType === 'ping') {
        query += `${timeFilter} ping.executed_at >= NOW() - INTERVAL '${hours} hours'`
        countQuery += `${timeFilter} ping.executed_at >= NOW() - INTERVAL '${hours} hours'`
      } else if (testType === 'traceroute') {
        query += `${timeFilter} traceroute.executed_at >= NOW() - INTERVAL '${hours} hours'`
        countQuery += `${timeFilter} traceroute.executed_at >= NOW() - INTERVAL '${hours} hours'`
      } else if (testType === 'speed_upload') {
        query += `${timeFilter} upload.executed_at >= NOW() - INTERVAL '${hours} hours'`
        countQuery += `${timeFilter} upload.executed_at >= NOW() - INTERVAL '${hours} hours'`
      } else if (testType === 'speed_download') {
        query += `${timeFilter} download.executed_at >= NOW() - INTERVAL '${hours} hours'`
        countQuery += `${timeFilter} download.executed_at >= NOW() - INTERVAL '${hours} hours'`
      } else if (testType === 'speed') {
        query += `${timeFilter} speed.executed_at >= NOW() - INTERVAL '${hours} hours'`
        countQuery += `${timeFilter} speed.executed_at >= NOW() - INTERVAL '${hours} hours'`
      } else {
        query += `${timeFilter} qj.created_at >= NOW() - INTERVAL '${hours} hours'`
        countQuery += `${timeFilter} qj.created_at >= NOW() - INTERVAL '${hours} hours'`
      }
    }

    query += ` ORDER BY `
    if (testType === 'ping') {
      query += `ping.executed_at DESC NULLS LAST`
    } else if (testType === 'traceroute') {
      query += `traceroute.executed_at DESC NULLS LAST`
    } else if (testType === 'speed_upload') {
      query += `upload.executed_at DESC NULLS LAST`
    } else if (testType === 'speed_download') {
      query += `download.executed_at DESC NULLS LAST`
    } else if (testType === 'speed') {
      query += `speed.executed_at DESC NULLS LAST`
    } else {
      query += `qj.created_at DESC NULLS LAST`
    }
    query += ` LIMIT $1 OFFSET $2`

    const [result, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, countParams)
    ])

    const total = parseInt(countResult.rows[0].total)

    return NextResponse.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching queue results:', error)
    return NextResponse.json(
      { error: 'Failed to fetch queue results' },
      { status: 500 }
    )
  }
}
