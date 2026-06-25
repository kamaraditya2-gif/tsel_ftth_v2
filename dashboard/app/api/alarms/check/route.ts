import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const areaId = searchParams.get('area_id')
    const regionalId = searchParams.get('regional_id')
    const nopId = searchParams.get('nop_id')
    const brand = searchParams.get('brand')
    const ontType = searchParams.get('ont_type')
    const severity = searchParams.get('severity')

    const client = await pool.connect()

    // Ambil semua threshold aktif
    const threshRes = await client.query(`SELECT * FROM threshold_master WHERE status = 'active'`)
    const thresholds = threshRes.rows

    // Ambil latest test results per device
    let filterJoin = ''
    const filterConds: string[] = []
    const params: any[] = []
    let pIdx = 1

    if (areaId) { filterJoin += 'JOIN master_cluster_nop fn ON fn.id = d.cluster_nop_id'; filterConds.push(`fn.area_id = $${pIdx++}`); params.push(parseInt(areaId)) }
    if (regionalId) { filterConds.push(`d.downstream_server_id = $${pIdx++}`); params.push(parseInt(regionalId)) }
    if (nopId) { filterConds.push(`d.cluster_nop_id = $${pIdx++}`); params.push(parseInt(nopId)) }
    if (brand) { filterConds.push(`d.manufacturer = $${pIdx++}`); params.push(brand) }
    if (ontType) { filterConds.push(`d.cpe_type = $${pIdx++}`); params.push(ontType) }

    const filterSQL = filterConds.length > 0 ? `AND ${filterConds.join(' AND ')}` : ''
    const filterJoinSQL = filterJoin

    // Also check for existing root causes and tickets per device
    const rootCauseRes = await client.query('SELECT * FROM device_alarm_root_cause')
    const rootCauseMap = new Map(rootCauseRes.rows.map(r => [r.device_id, r]))
    const ticketRes = await client.query("SELECT * FROM alarm_tickets WHERE status IN ('open','in_progress')")
    const ticketMap = new Map(ticketRes.rows.map(t => [t.device_id, t]))
    const rootCauseDefs = (await client.query('SELECT id, name, category FROM alarm_root_cause ORDER BY category, name')).rows

    const devicesRes = await client.query(`
      SELECT
        d.id, d.device_name, d.serial_number, d.manufacturer as brand, d.cpe_type as ont_type,
        d.speed_id, sg.name as speed_name, sg.speed_limit,
        p.ping_igw as latency, p.packet_loss_igw as packet_loss,
        sd.download_speed as download,
        su.upload_speed as upload
      FROM devices_ont d
      LEFT JOIN speed_group sg ON sg.id = d.speed_id
      LEFT JOIN LATERAL (
        SELECT ping_igw, packet_loss_igw, executed_at
        FROM test_results_ping WHERE device_id = d.id
        ORDER BY executed_at DESC LIMIT 1
      ) p ON true
      LEFT JOIN LATERAL (
        SELECT download_speed, executed_at
        FROM test_results_speed_download WHERE device_id = d.id
        ORDER BY executed_at DESC LIMIT 1
      ) sd ON true
      LEFT JOIN LATERAL (
        SELECT upload_speed, executed_at
        FROM test_results_speed_upload WHERE device_id = d.id
        ORDER BY executed_at DESC LIMIT 1
      ) su ON true
      ${filterJoinSQL}
      WHERE (p.ping_igw IS NOT NULL OR sd.download_speed IS NOT NULL OR su.upload_speed IS NOT NULL)
      ${filterSQL}
      ORDER BY d.device_name
    `, params)

    client.release()

    const devices = devicesRes.rows
    const alarms: any[] = []

    let alarmCounter = 0

    for (const device of devices) {
      const deviceAlarms: any[] = []

      for (const th of thresholds) {
        let violated = false
        let currentValue: number | null = null
        let thresholdValue = th.critical_value
        let alarmSeverity = 'warning'

        // Latency threshold (UPPER)
        if (th.alarm_name === 'Latency' && device.latency != null) {
          currentValue = parseFloat(device.latency)
          if (currentValue > th.critical_value) {
            violated = true; alarmSeverity = 'critical'; thresholdValue = th.critical_value
          } else if (currentValue > th.warning_value) {
            violated = true; thresholdValue = th.warning_value
          }
        }

        // Packet Loss threshold (UPPER)
        if (th.alarm_name === 'Packet_Loss' && device.packet_loss != null) {
          currentValue = parseFloat(device.packet_loss)
          if (currentValue > th.critical_value) {
            violated = true; alarmSeverity = 'critical'; thresholdValue = th.critical_value
          } else if (currentValue > th.warning_value) {
            violated = true; thresholdValue = th.warning_value
          }
        }

        // Download Speed (LOWER — percentage of speed package)
        if (th.alarm_name === 'Download_Speed' && device.download != null && device.speed_limit) {
          const pctThreshold = th.warning_value // user memasukkan persentase
          const pctCritical = th.critical_value
          currentValue = parseFloat(device.download)
          const speedLimit = parseFloat(device.speed_limit)
          const pctOfPackage = (currentValue / speedLimit) * 100

          if (pctOfPackage < pctCritical) {
            violated = true; alarmSeverity = 'critical'; thresholdValue = pctCritical
          } else if (pctOfPackage < pctThreshold) {
            violated = true; thresholdValue = pctThreshold
          }
        }

        // Upload Speed (LOWER — percentage of speed package)
        if (th.alarm_name === 'Upload_Speed' && device.upload != null && device.speed_limit) {
          const pctThreshold = th.warning_value
          const pctCritical = th.critical_value
          currentValue = parseFloat(device.upload)
          const speedLimit = parseFloat(device.speed_limit)
          const pctOfPackage = (currentValue / speedLimit) * 100

          if (pctOfPackage < pctCritical) {
            violated = true; alarmSeverity = 'critical'; thresholdValue = pctCritical
          } else if (pctOfPackage < pctThreshold) {
            violated = true; thresholdValue = pctThreshold
          }
        }

    if (violated) {
          deviceAlarms.push({
            alarm_code: 'ALM-' + Date.now().toString(36).toUpperCase() + '-' + String(++alarmCounter).padStart(3,'0'),
            alarm_type: th.alarm_name,
            category: th.category,
            metric_value: currentValue,
            threshold_value: thresholdValue,
            severity: alarmSeverity,
            unit: th.unit,
          })
        }
      }

      const rootCause = rootCauseMap.get(device.id)
      const ticket = ticketMap.get(device.id)

      if (deviceAlarms.length > 0) {
        alarms.push({
          device_id: device.id,
          device_name: device.device_name,
          serial_number: device.serial_number,
          brand: device.brand,
          ont_type: device.ont_type,
          speed_name: device.speed_name,
          speed_limit: device.speed_limit,
          latency: device.latency,
          packet_loss: device.packet_loss,
          download: device.download,
          upload: device.upload,
          alarms: deviceAlarms,
          max_severity: deviceAlarms.some(a => a.severity === 'critical') ? 'critical' : 'warning',
          root_cause: rootCause ? { id: rootCause.root_cause_id, note: rootCause.root_cause_note } : null,
          ticket: ticket ? { id: ticket.id, number: ticket.ticket_number, status: ticket.status } : null,
        })
      }
    }

    // Devices with test data but NO violations = cleared
    const clearedDevices = devices
      .filter(d => !alarms.some(a => a.device_id === d.id))
      .map(d => {
        const rootCause = rootCauseMap.get(d.id)
        const ticket = ticketMap.get(d.id)
        return {
          device_id: d.id,
          device_name: d.device_name,
          serial_number: d.serial_number,
          brand: d.brand,
          ont_type: d.ont_type,
          speed_name: d.speed_name,
          speed_limit: d.speed_limit,
          latency: d.latency,
          packet_loss: d.packet_loss,
          download: d.download,
          upload: d.upload,
          alarms: [],
          max_severity: 'cleared',
          root_cause: rootCause ? { id: rootCause.root_cause_id, note: rootCause.root_cause_note } : null,
          ticket: ticket ? { id: ticket.id, number: ticket.ticket_number, status: ticket.status } : null,
        }
      })

    let filtered = alarms

    return NextResponse.json({
      total: filtered.length,
      alarms: filtered,
      cleared: clearedDevices,
      total_cleared: clearedDevices.length,
      root_causes: rootCauseDefs,
      threshold_count: thresholds.length,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}