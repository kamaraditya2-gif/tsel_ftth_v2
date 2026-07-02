import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { parseIds, buildOptionalFilter } from '@/lib/filter-utils'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const reportType = searchParams.get('type') || 'alarm-area'
  const areaId = searchParams.get('area_id')
  const regionalId = searchParams.get('regional_id')
  const nopId = searchParams.get('nop_id')
  const brand = searchParams.get('brand')
  const ontType = searchParams.get('ont_type')

  let whereExtra = ''
  const params: any[] = []
  let pIdx = 1

  const areaIdFilter = buildOptionalFilter('ma.id', areaId, searchParams.get('area_ids'), () => pIdx++, params)
  if (areaIdFilter) whereExtra += ` AND ${areaIdFilter}`

  const regionalIdFilter = buildOptionalFilter('ds.id', regionalId, searchParams.get('regional_ids'), () => pIdx++, params)
  if (regionalIdFilter) whereExtra += ` AND ${regionalIdFilter}`

  const nopIdFilter = buildOptionalFilter('n.id', nopId, searchParams.get('nop_ids'), () => pIdx++, params)
  if (nopIdFilter) whereExtra += ` AND ${nopIdFilter}`
  if (brand) { whereExtra += ` AND d.manufacturer = $${pIdx++}`; params.push(brand) }
  if (ontType) { whereExtra += ` AND d.cpe_type = $${pIdx++}`; params.push(ontType) }

  try {
    const client = await pool.connect()
    let query = ''

    switch (reportType) {
      case 'alarm-area':
        query = `
          SELECT ma.name as area, COUNT(*) as total_alarms,
            COUNT(*) FILTER (WHERE aa.severity = 'critical') as critical,
            COUNT(*) FILTER (WHERE aa.severity = 'warning') as warning
          FROM active_alarms aa
          JOIN devices_ont d ON d.id = aa.device_id
          LEFT JOIN master_cluster_nop n ON n.id = d.cluster_nop_id
          LEFT JOIN downstream_servers ds ON ds.id = d.downstream_server_id
          LEFT JOIN master_area ma ON ma.id = n.area_id
          WHERE 1=1 ${whereExtra}
          GROUP BY ma.name ORDER BY total_alarms DESC
        `
        break
      case 'alarm-regional':
        query = `
          SELECT ds.name as regional, COUNT(*) as total_alarms,
            COUNT(*) FILTER (WHERE aa.severity = 'critical') as critical,
            COUNT(*) FILTER (WHERE aa.severity = 'warning') as warning
          FROM active_alarms aa
          JOIN devices_ont d ON d.id = aa.device_id
          LEFT JOIN downstream_servers ds ON ds.id = d.downstream_server_id
          LEFT JOIN master_cluster_nop n ON n.id = d.cluster_nop_id
          LEFT JOIN master_area ma ON ma.id = n.area_id
          WHERE 1=1 ${whereExtra}
          GROUP BY ds.name ORDER BY total_alarms DESC
        `
        break
      case 'alarm-nop':
        query = `
          SELECT n.name as nop, COUNT(*) as total_alarms,
            COUNT(*) FILTER (WHERE aa.severity = 'critical') as critical,
            COUNT(*) FILTER (WHERE aa.severity = 'warning') as warning
          FROM active_alarms aa
          JOIN devices_ont d ON d.id = aa.device_id
          LEFT JOIN master_cluster_nop n ON n.id = d.cluster_nop_id
          LEFT JOIN downstream_servers ds ON ds.id = d.downstream_server_id
          LEFT JOIN master_area ma ON ma.id = n.area_id
          WHERE 1=1 ${whereExtra}
          GROUP BY n.name ORDER BY total_alarms DESC
        `
        break
      case 'alarm-brand':
        query = `
          SELECT d.manufacturer as brand, COUNT(*) as total_alarms,
            COUNT(*) FILTER (WHERE aa.severity = 'critical') as critical,
            COUNT(*) FILTER (WHERE aa.severity = 'warning') as warning,
            COUNT(DISTINCT d.id) as devices
          FROM active_alarms aa
          JOIN devices_ont d ON d.id = aa.device_id
          LEFT JOIN master_cluster_nop n ON n.id = d.cluster_nop_id
          LEFT JOIN downstream_servers ds ON ds.id = d.downstream_server_id
          LEFT JOIN master_area ma ON ma.id = n.area_id
          WHERE d.manufacturer IS NOT NULL ${whereExtra}
          GROUP BY d.manufacturer ORDER BY total_alarms DESC
        `
        break
      case 'alarm-ont-type':
        query = `
          SELECT d.cpe_type as ont_type, COUNT(*) as total_alarms,
            COUNT(*) FILTER (WHERE aa.severity = 'critical') as critical,
            COUNT(*) FILTER (WHERE aa.severity = 'warning') as warning,
            COUNT(DISTINCT d.id) as devices
          FROM active_alarms aa
          JOIN devices_ont d ON d.id = aa.device_id
          LEFT JOIN master_cluster_nop n ON n.id = d.cluster_nop_id
          LEFT JOIN downstream_servers ds ON ds.id = d.downstream_server_id
          LEFT JOIN master_area ma ON ma.id = n.area_id
          WHERE d.cpe_type IS NOT NULL ${whereExtra}
          GROUP BY d.cpe_type ORDER BY total_alarms DESC
        `
        break
      case 'availability':
        query = `
          SELECT ma.name as area, ds.name as regional, n.name as nop,
            COUNT(*) as total_devices,
            ROUND(COUNT(*) FILTER (WHERE d.status = 'online')::numeric / NULLIF(COUNT(*), 0) * 100, 1) as availability_pct,
            ROUND(AVG(p.ping_igw)::numeric, 1) as avg_latency
          FROM devices_ont d
          LEFT JOIN master_cluster_nop n ON n.id = d.cluster_nop_id
          LEFT JOIN downstream_servers ds ON ds.id = d.downstream_server_id
          LEFT JOIN master_area ma ON ma.id = n.area_id
          LEFT JOIN test_results_ping p ON p.device_id = d.id AND p.executed_at > NOW() - INTERVAL '24 hours'
          WHERE 1=1 ${whereExtra}
          GROUP BY ma.name, ds.name, n.name ORDER BY availability_pct ASC
        `
        break
      case 'rca':
        query = `
          SELECT aa.alarm_type, COUNT(*) as total,
            COUNT(*) FILTER (WHERE aa.severity = 'critical') as critical,
            COUNT(*) FILTER (WHERE aa.severity = 'warning') as warning,
            ROUND(AVG(aa.metric_value)::numeric, 1) as avg_value
          FROM active_alarms aa
          JOIN devices_ont d ON d.id = aa.device_id
          LEFT JOIN master_cluster_nop n ON n.id = d.cluster_nop_id
          LEFT JOIN downstream_servers ds ON ds.id = d.downstream_server_id
          LEFT JOIN master_area ma ON ma.id = n.area_id
          WHERE 1=1 ${whereExtra}
          GROUP BY aa.alarm_type ORDER BY total DESC
        `
        break
      case 'performance':
        query = `
          SELECT 
            ROUND(AVG(p.ping_igw)::numeric, 1) as avg_latency_ms,
            ROUND(AVG(p.ping_ebr)::numeric, 1) as avg_ebr_latency_ms,
            ROUND(AVG(p.packet_loss_igw)::numeric, 1) as avg_packet_loss_pct,
            ROUND(AVG(sd.download_speed)::numeric, 1) as avg_download_mbps,
            ROUND(AVG(su.upload_speed)::numeric, 1) as avg_upload_mbps
          FROM devices_ont d
          LEFT JOIN test_results_ping p ON p.device_id = d.id AND p.executed_at > NOW() - INTERVAL '24 hours'
          LEFT JOIN test_results_speed_download sd ON sd.device_id = d.id AND sd.executed_at > NOW() - INTERVAL '24 hours'
          LEFT JOIN test_results_speed_upload su ON su.device_id = d.id AND su.executed_at > NOW() - INTERVAL '24 hours'
          LEFT JOIN master_cluster_nop n ON n.id = d.cluster_nop_id
          LEFT JOIN downstream_servers ds ON ds.id = d.downstream_server_id
          LEFT JOIN master_area ma ON ma.id = n.area_id
          WHERE 1=1 ${whereExtra}
        `
        break
      default:
        query = `SELECT 'invalid report type' as message`
    }

    const result = await client.query(query, params)
    client.release()
    return NextResponse.json({ data: result.rows })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}