import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  try {
    const client = await pool.connect()

    // Row 1: KPI Cards
    const kpiResult = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM devices_ont) as total_device,
        (SELECT COUNT(*) FROM active_alarms) as active_alarm,
        (SELECT COUNT(*) FROM active_alarms WHERE severity = 'critical') as l1_alarm,
        (SELECT COUNT(*) FROM active_alarms WHERE severity = 'warning') as l2_alarm,
        (SELECT ROUND(COUNT(*) FILTER (WHERE status = 'online')::numeric / NULLIF(COUNT(*), 0) * 100, 1) FROM devices_ont) as availability,
        (SELECT MAX(last_seen) FROM devices_ont) as last_check
    `)

    // Row 2: Threshold Summary
    const thresholdResult = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE threshold_type = 'LOWER') as under_threshold,
        COUNT(*) FILTER (WHERE threshold_type = 'UPPER') as upper_threshold,
        COUNT(*) FILTER (WHERE status = 'active') as total_active,
        ROUND(AVG(warning_value), 1) as avg_warning,
        ROUND(AVG(critical_value), 1) as avg_critical
      FROM threshold_master
    `)

    // Row 3: Root Cause Analysis (alarm by type)
    const rootCauseResult = await client.query(`
      SELECT alarm_type, COUNT(*) as count, severity
      FROM active_alarms
      GROUP BY alarm_type, severity
      ORDER BY COUNT(*) DESC
    `)

    // Row 4 & 5: L1 & L2 categorized
    const l1L2Result = await client.query(`
      SELECT alarm_type,
        COUNT(*) FILTER (WHERE severity = 'critical') as l1_count,
        COUNT(*) FILTER (WHERE severity = 'warning') as l2_count
      FROM active_alarms
      GROUP BY alarm_type
      ORDER BY alarm_type
    `)

    // Row 6: Top Alarm Analytics
    const topRegionResult = await client.query(`
      SELECT COALESCE(ds.name, 'Unknown') as name, COUNT(*) as count
      FROM active_alarms aa
      JOIN devices_ont d ON d.id = aa.device_id
      LEFT JOIN downstream_servers ds ON ds.id = d.downstream_server_id
      GROUP BY ds.name
      ORDER BY COUNT(*) DESC LIMIT 5
    `)

    const topNopResult = await client.query(`
      SELECT COALESCE(n.name, 'Unknown') as name, COUNT(*) as count
      FROM active_alarms aa
      JOIN devices_ont d ON d.id = aa.device_id
      LEFT JOIN master_cluster_nop n ON n.id = d.cluster_nop_id
      GROUP BY n.name
      ORDER BY COUNT(*) DESC LIMIT 5
    `)

    const topBrandResult = await client.query(`
      SELECT COALESCE(d.manufacturer, 'Unknown') as name, COUNT(*) as count
      FROM active_alarms aa
      JOIN devices_ont d ON d.id = aa.device_id
      GROUP BY d.manufacturer
      ORDER BY COUNT(*) DESC LIMIT 5
    `)

    const topOntTypeResult = await client.query(`
      SELECT COALESCE(d.cpe_type, 'Unknown') as name, COUNT(*) as count
      FROM active_alarms aa
      JOIN devices_ont d ON d.id = aa.device_id
      GROUP BY d.cpe_type
      ORDER BY COUNT(*) DESC LIMIT 5
    `)

    // Row 7: Performance Analytics
    const perfResult = await client.query(`
      SELECT
        COALESCE(ROUND(AVG(p.ping_igw)::numeric, 1), 0) as avg_latency,
        COALESCE(ROUND(AVG(p.ping_ebr)::numeric, 1), 0) as avg_ebr_latency,
        COALESCE(ROUND(AVG(p.packet_loss_igw)::numeric, 1), 0) as avg_packet_loss,
        (SELECT ROUND(COUNT(*) FILTER (WHERE status = 'online')::numeric / NULLIF(COUNT(*), 0) * 100, 1) FROM devices_ont) as avg_availability
      FROM devices_ont d
      LEFT JOIN test_results_ping p ON p.device_id = d.id
        AND p.executed_at > NOW() - INTERVAL '24 hours'
    `)

    client.release()

    return NextResponse.json({
      kpi: kpiResult.rows[0],
      threshold: thresholdResult.rows[0],
      rootCause: rootCauseResult.rows,
      l1l2: l1L2Result.rows,
      topAlarms: {
        regions: topRegionResult.rows,
        nops: topNopResult.rows,
        brands: topBrandResult.rows,
        ontTypes: topOntTypeResult.rows,
      },
      performance: perfResult.rows[0],
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}