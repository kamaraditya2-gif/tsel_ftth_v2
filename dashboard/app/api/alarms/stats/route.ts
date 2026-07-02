import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { parseIds, buildOptionalFilter } from '@/lib/filter-utils'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const areaId = searchParams.get('areaId')
    const regionalId = searchParams.get('regionalId')
    const nopId = searchParams.get('nopId')
    const timeRange = searchParams.get('timeRange') || '24h'

    const intervalMap: Record<string, string> = {
      '1h': '1 hour',
      '6h': '6 hours',
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days'
    }
    const interval = intervalMap[timeRange] || '24 hours'

    const filterConditions: string[] = []
    const filterParams: any[] = []
    let paramIndex = 1

    const areaIdFilter = buildOptionalFilter('area_id', areaId, searchParams.get('areaIds'), () => paramIndex++, filterParams)
    if (areaIdFilter) filterConditions.push(`d.cluster_nop_id IN (SELECT id FROM master_cluster_nop WHERE ${areaIdFilter})`)

    const regionalIdFilter = buildOptionalFilter('d.downstream_server_id', regionalId, searchParams.get('regionalIds'), () => paramIndex++, filterParams)
    if (regionalIdFilter) filterConditions.push(regionalIdFilter)

    const nopIdFilter = buildOptionalFilter('d.cluster_nop_id', nopId, searchParams.get('nopIds'), () => paramIndex++, filterParams)
    if (nopIdFilter) filterConditions.push(nopIdFilter)

    const whereJoin = filterConditions.length > 0 ? `AND ${filterConditions.join(' AND ')}` : ''
    const client = await pool.connect()

    // Active alarms
    const activeResult = await client.query(`
      SELECT
        aa.alarm_type,
        aa.severity,
        COUNT(*) as count
      FROM active_alarms aa
      JOIN devices_ont d ON d.id = aa.device_id
      WHERE 1=1 ${whereJoin}
      GROUP BY aa.alarm_type, aa.severity
    `, filterParams)

    const totalActive = await client.query(`
      SELECT COUNT(*) as total
      FROM active_alarms aa
      JOIN devices_ont d ON d.id = aa.device_id
      WHERE 1=1 ${whereJoin}
    `, filterParams)

    const activeBySeverity = await client.query(`
      SELECT severity, COUNT(*) as count
      FROM active_alarms aa
      JOIN devices_ont d ON d.id = aa.device_id
      WHERE 1=1 ${whereJoin}
      GROUP BY severity
    `, filterParams)

    // Cleared alarms from alarm_history (within time range)
    const clearedResult = await client.query(`
      SELECT
        ah.alarm_type,
        ah.severity,
        COUNT(*) as count
      FROM alarm_history ah
      JOIN devices_ont d ON d.id = ah.device_id
      WHERE ah.cleared_at > NOW() - INTERVAL '${interval}' ${whereJoin}
      GROUP BY ah.alarm_type, ah.severity
    `, filterParams)

    const totalCleared = await client.query(`
      SELECT COUNT(*) as total
      FROM alarm_history ah
      JOIN devices_ont d ON d.id = ah.device_id
      WHERE ah.cleared_at > NOW() - INTERVAL '${interval}' ${whereJoin}
    `, filterParams)

    const clearedBySeverity = await client.query(`
      SELECT severity, COUNT(*) as count
      FROM alarm_history ah
      JOIN devices_ont d ON d.id = ah.device_id
      WHERE ah.cleared_at > NOW() - INTERVAL '${interval}' ${whereJoin}
      GROUP BY severity
    `, filterParams)

    client.release()

    const buildTypeMap = (rows: any[]) => {
      const map: Record<string, number> = {}
      rows.forEach(row => {
        map[row.alarm_type] = (map[row.alarm_type] || 0) + parseInt(row.count)
      })
      return map
    }

    const buildSeverityMap = (rows: any[]) => {
      const map: Record<string, number> = {}
      rows.forEach(row => {
        map[row.severity] = parseInt(row.count)
      })
      return map
    }

    return NextResponse.json({
      active: {
        total: parseInt(totalActive.rows[0].total),
        byType: buildTypeMap(activeResult.rows),
        bySeverity: buildSeverityMap(activeBySeverity.rows),
        details: activeResult.rows.map(r => ({
          type: r.alarm_type,
          severity: r.severity,
          count: parseInt(r.count)
        }))
      },
      cleared: {
        total: parseInt(totalCleared.rows[0].total),
        byType: buildTypeMap(clearedResult.rows),
        bySeverity: buildSeverityMap(clearedBySeverity.rows),
        details: clearedResult.rows.map(r => ({
          type: r.alarm_type,
          severity: r.severity,
          count: parseInt(r.count)
        }))
      }
    })
  } catch (error: any) {
    console.error('Alarm stats error:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch alarm stats' }, { status: 500 })
  }
}
