import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const client = await pool.connect()

    // 1. Severity Summary — classify devices by worst metric vs threshold
    const severityRes = await client.query(`
      WITH latest AS (
        SELECT DISTINCT ON (d.id) d.id,
          p.ping_igw, p.packet_loss_igw,
          sd.download_speed, su.upload_speed,
          sg.download_threshold, sg.upload_threshold
        FROM devices_ont d
        LEFT JOIN LATERAL (SELECT ping_igw, packet_loss_igw FROM test_results_ping WHERE device_id = d.id ORDER BY executed_at DESC LIMIT 1) p ON true
        LEFT JOIN LATERAL (SELECT download_speed FROM test_results_speed_download WHERE device_id = d.id ORDER BY executed_at DESC LIMIT 1) sd ON true
        LEFT JOIN LATERAL (SELECT upload_speed FROM test_results_speed_upload WHERE device_id = d.id ORDER BY executed_at DESC LIMIT 1) su ON true
        LEFT JOIN speed_group sg ON sg.id = d.speed_id
      )
      SELECT
        COUNT(*) FILTER (
          WHERE (ping_igw > 100) OR (packet_loss_igw > 5)
             OR (download_speed IS NOT NULL AND download_threshold IS NOT NULL AND download_speed < download_threshold * 0.5)
             OR (upload_speed IS NOT NULL AND upload_threshold IS NOT NULL AND upload_speed < upload_threshold * 0.5)
        ) as critical,
        COUNT(*) FILTER (
          WHERE ((ping_igw > 50 AND ping_igw <= 100) OR (packet_loss_igw > 2 AND packet_loss_igw <= 5))
             OR (download_speed IS NOT NULL AND download_threshold IS NOT NULL AND download_speed >= download_threshold * 0.5 AND download_speed < download_threshold * 0.8)
             OR (upload_speed IS NOT NULL AND upload_threshold IS NOT NULL AND upload_speed >= upload_threshold * 0.5 AND upload_speed < upload_threshold * 0.8)
        ) as major,
        COUNT(*) FILTER (
          WHERE (ping_igw <= 50 OR ping_igw IS NULL)
             AND (packet_loss_igw <= 2 OR packet_loss_igw IS NULL)
             AND ((download_speed IS NULL OR download_threshold IS NULL) OR download_speed >= download_threshold * 0.8)
             AND ((upload_speed IS NULL OR upload_threshold IS NULL) OR upload_speed >= upload_threshold * 0.8)
        ) as minor,
        COUNT(*) as total
      FROM latest
    `)
    const sev = severityRes.rows[0]

    // 2. Root Cause by L1 category (from alarm_root_cause)
    const rootCauseL1 = await client.query(`
      SELECT rc.category as name, COUNT(*) as count
      FROM device_alarm_root_cause darc
      JOIN alarm_root_cause rc ON rc.id = darc.root_cause_id
      GROUP BY rc.category ORDER BY COUNT(*) DESC
    `)

    // 3. Root Cause by L2 name
    const rootCauseL2 = await client.query(`
      SELECT rc.category, rc.name, COUNT(*) as count
      FROM device_alarm_root_cause darc
      JOIN alarm_root_cause rc ON rc.id = darc.root_cause_id
      GROUP BY rc.category, rc.name ORDER BY COUNT(*) DESC
    `)

    // 4. Availability (successful ping / total ping)
    const availRes = await client.query(`
      SELECT
        ROUND(COUNT(*) FILTER (WHERE success = true)::numeric / NULLIF(COUNT(*), 0) * 100, 2) as availability,
        COUNT(*) FILTER (WHERE success = true) as success_count,
        COUNT(*) as total_count
      FROM test_results_ping WHERE executed_at > NOW() - INTERVAL '24 hours'
    `)

    // 5. Top Alarm — devices failing for 7+ consecutive days
    const topAlarmRes = await client.query(`
      WITH daily_fail AS (
        SELECT p.device_id, d.serial_number, d.device_name,
          DATE(p.executed_at) as day,
          BOOL_OR(p.success = false) as any_fail
        FROM test_results_ping p
        JOIN devices_ont d ON d.id = p.device_id
        WHERE p.executed_at > NOW() - INTERVAL '30 days'
        GROUP BY p.device_id, d.serial_number, d.device_name, DATE(p.executed_at)
      ), fail_streak AS (
        SELECT device_id, serial_number, device_name, day,
          ROW_NUMBER() OVER (PARTITION BY device_id ORDER BY day) as rn
        FROM daily_fail WHERE any_fail = true
      )
      SELECT device_id, serial_number, device_name,
        COUNT(*) as consecutive_days
      FROM fail_streak
      GROUP BY device_id, serial_number, device_name, day - rn::integer
      HAVING COUNT(*) >= 7
      ORDER BY COUNT(*) DESC LIMIT 10
    `)

    // 6. KPI basics
    const kpiRes = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM devices_ont) as total_device,
        (SELECT COUNT(*) FROM active_alarms) as active_alarm,
        (SELECT COUNT(*) FROM active_alarms WHERE severity = 'critical') as l1_alarm,
        (SELECT COUNT(*) FROM active_alarms WHERE severity = 'warning') as l2_alarm,
        (SELECT ROUND(COUNT(*) FILTER (WHERE status = 'online')::numeric / NULLIF(COUNT(*), 0) * 100, 1) FROM devices_ont) as availability,
        (SELECT MAX(last_seen) FROM devices_ont) as last_check
    `)

    // 7. Performance
    const perfRes = await client.query(`
      SELECT
        COALESCE(ROUND(AVG(ping_igw)::numeric, 1), 0) as avg_latency,
        COALESCE(ROUND(AVG(ping_ebr)::numeric, 1), 0) as avg_ebr_latency,
        COALESCE(ROUND(AVG(packet_loss_igw)::numeric, 1), 0) as avg_packet_loss
      FROM test_results_ping WHERE executed_at > NOW() - INTERVAL '24 hours'
    `)

    // 8. Latency trend (for detail)
    const trendRes = await client.query(`
      SELECT DATE(executed_at) as day,
        ROUND(AVG(ping_igw)::numeric, 1) as avg_ping_igw,
        ROUND(AVG(ping_ebr)::numeric, 1) as avg_ping_ebr
      FROM test_results_ping
      WHERE executed_at > NOW() - INTERVAL '7 days'
      GROUP BY DATE(executed_at) ORDER BY day
    `)

    client.release()

    return NextResponse.json({
      severity: {
        critical: parseInt(sev.critical),
        major: parseInt(sev.major),
        minor: parseInt(sev.minor),
        total: parseInt(sev.total),
        criticalPct: sev.total > 0 ? Number((sev.critical / sev.total * 100).toFixed(1)) : 0,
        majorPct: sev.total > 0 ? Number((sev.major / sev.total * 100).toFixed(1)) : 0,
        minorPct: sev.total > 0 ? Number((sev.minor / sev.total * 100).toFixed(1)) : 0,
      },
      rootCause: {
        l1: rootCauseL1.rows,
        l2: rootCauseL2.rows,
      },
      availability: {
        pct: Number(availRes.rows[0]?.availability || 0),
        successCount: parseInt(availRes.rows[0]?.success_count || 0),
        totalCount: parseInt(availRes.rows[0]?.total_count || 0),
      },
      topAlarms: topAlarmRes.rows,
      kpi: kpiRes.rows[0],
      performance: perfRes.rows[0],
      trend: trendRes.rows,
    })
  } catch (error: any) {
    console.error('V2 API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
