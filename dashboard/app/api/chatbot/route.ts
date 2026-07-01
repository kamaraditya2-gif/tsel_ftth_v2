import { NextResponse } from 'next/server'
import pool from '@/lib/db'
export const dynamic = 'force-dynamic'

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || ''
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1'
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

// ── RAG: Query database based on user intent ──────────────────────────────

async function fetchRAGContext(message: string): Promise<string> {
  const lowerMsg = message.toLowerCase()
  let contextParts: string[] = []

  // Always include basic stats
  try {
    const client = await pool.connect()

    // 1. Device overview (ALWAYS included)
    const deviceRes = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'online') as online,
        COUNT(*) FILTER (WHERE status = 'offline') as offline
      FROM devices_ont
    `)
    const d = deviceRes.rows[0]
    contextParts.push(`📊 DEVICE OVERVIEW: Total ${d.total} ONT, ${d.online} online, ${d.offline} offline`)

    // 1a. Specific device search — detect serial number or device query
    const devicePatterns = [
      ...(message.match(/[A-Z0-9]{6,20}/g) || []),        // potential serial numbers (6+ alphanumeric)
      ...(message.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g) || []),  // IP addresses
    ]
    const wantsDevice = lowerMsg.includes('device') || lowerMsg.includes('perangkat') || lowerMsg.includes('ont') || 
                        lowerMsg.includes('serial') || lowerMsg.includes('detail') || devicePatterns.length > 0

    if (wantsDevice) {
      const searchPatterns = devicePatterns.length > 0 ? devicePatterns : [message.replace(/.*?(device|perangkat|ont|serial|detail|cari|nama)\s*/i, '').trim()]
      
      for (const pattern of searchPatterns) {
        if (pattern.length < 2) continue
        const devRes = await client.query(`
          SELECT 
            d.id, d.serial_number, d.device_name, d.ip_address::text,
            d.mac_address, d.status, d.manufacturer as brand, d.cpe_type as ont_type,
            d.indihome_id, d.group_id,
            COALESCE(ds.name, 'N/A') as region,
            COALESCE(n.name, 'N/A') as nop,
            d.downstream_server_id, d.cluster_nop_id,
            d.lat, d.lng
          FROM devices_ont d
          LEFT JOIN downstream_servers ds ON d.downstream_server_id = ds.id
          LEFT JOIN master_cluster_nop n ON d.cluster_nop_id = n.id
          WHERE d.serial_number ILIKE $1
             OR d.device_name ILIKE $1
             OR d.ip_address::text = $2
             OR d.mac_address ILIKE $1
             OR d.indihome_id ILIKE $1
          LIMIT 5
        `, [`%${pattern}%`, pattern])
        
        if (devRes.rows.length > 0) {
          contextParts.push(`📱 DEVICE SEARCH RESULTS for "${pattern}":\n${devRes.rows.map((r: any) =>
            `  - ${r.serial_number} (${r.device_name || 'N/A'})
             Status: ${r.status}
             Brand: ${r.brand || 'N/A'}, Type: ${r.ont_type || 'N/A'}
             IP: ${r.ip_address || 'N/A'}, MAC: ${r.mac_address || 'N/A'}
             IndiHome: ${r.indihome_id || 'N/A'}
             Region: ${r.region}, NOP: ${r.nop}
             Group: ${r.group_id || 'N/A'}
             Location: ${r.lat ? `${r.lat}, ${r.lng}` : 'N/A'}`
          ).join('\n')}`)

          // Also fetch recent test results for found devices
          const ids = devRes.rows.map((r: any) => r.id)
          if (ids.length > 0) {
            const testRes = await client.query(`
              SELECT device_id,
                ROUND(ping_igw::numeric, 2) as ping_igw,
                ROUND(ping_ebr::numeric, 2) as ping_ebr,
                ROUND(packet_loss_igw::numeric, 2) as packet_loss,
                executed_at as ping_time
              FROM test_results_ping
              WHERE device_id = ANY($1::int[])
              ORDER BY executed_at DESC
              LIMIT 10
            `, [ids])
            if (testRes.rows.length > 0) {
              contextParts.push(`📊 RECENT TEST RESULTS:\n${testRes.rows.map((r: any) =>
                `  - Device #${r.device_id}: IGW ${r.ping_igw}ms, EBR ${r.ping_ebr}ms, Loss ${r.packet_loss}% (${new Date(r.ping_time).toLocaleString('id-ID')})`
              ).join('\n')}`)
            }

            // Active alarms for these devices
            const alarmDevRes = await client.query(`
              SELECT device_id, alarm_type, severity, COUNT(*) as count
              FROM active_alarms
              WHERE device_id = ANY($1::int[])
              GROUP BY device_id, alarm_type, severity
              ORDER BY device_id, count DESC
            `, [ids])
            if (alarmDevRes.rows.length > 0) {
              contextParts.push(`🔔 ALARMS:\n${alarmDevRes.rows.map((r: any) =>
                `  - Device #${r.device_id}: ${r.alarm_type.replace(/_/g, ' ')} (${r.severity}) — ${r.count}x`
              ).join('\n')}`)
            }
          }
        }
      }
    }

    // 1b. Recent failed tests (ALWAYS included)
    const failRes = await client.query(`
      SELECT COUNT(*) as total_failed
      FROM queue_jobs
      WHERE status = 'failed' AND created_at >= NOW() - INTERVAL '24 hours'
    `)
    contextParts.push(`❌ FAILED TESTS (24h): ${failRes.rows[0].total_failed} jobs failed`)

    // 2. Latest downstream latency
    if (lowerMsg.includes('latency') || lowerMsg.includes('ping') || lowerMsg.includes('lambat') || lowerMsg.includes('cepat')) {
      const latRes = await client.query(`
        SELECT 
          ROUND(AVG(avg_latency_ms)::numeric, 2) as avg_latency,
          ROUND(MIN(avg_latency_ms)::numeric, 2) as min_latency,
          ROUND(MAX(avg_latency_ms)::numeric, 2) as max_latency,
          COUNT(*) as total_tests
        FROM test_results_direct_ping
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      `)
      const l = latRes.rows[0]
      contextParts.push(`📡 DOWNSTREAM LATENCY (24h): Avg ${l.avg_latency}ms, Min ${l.min_latency}ms, Max ${l.max_latency}ms (${l.total_tests} tests)`)
    }

    // 3. Latest speed tests
    if (lowerMsg.includes('speed') || lowerMsg.includes('download') || lowerMsg.includes('upload') || lowerMsg.includes('kecepatan')) {
      const speedRes = await client.query(`
        SELECT 
          ROUND(AVG(download_speed)::numeric, 2) as avg_download,
          ROUND(AVG(upload_speed)::numeric, 2) as avg_upload,
          COUNT(*) FILTER (WHERE download_speed >= download_threshold) as pass,
          COUNT(*) FILTER (WHERE download_speed < download_threshold) as fail
        FROM test_results_speed_download t
        JOIN devices_ont d ON t.device_id = d.id
        JOIN speed_group s ON d.speed_id = s.id
        WHERE t.executed_at >= NOW() - INTERVAL '24 hours'
      `)
      const s = speedRes.rows[0]
      contextParts.push(`⚡ SPEED TESTS (24h): Avg Download ${s.avg_download} Mbps, Avg Upload ${s.avg_upload} Mbps, Pass ${s.pass}, Fail ${s.fail}`)
    }

    // 4. Packet loss
    if (lowerMsg.includes('packet loss') || lowerMsg.includes('loss') || lowerMsg.includes('hilang')) {
      const lossRes = await client.query(`
        SELECT 
          ROUND(AVG(packet_loss_percent)::numeric, 2) as avg_loss,
          COUNT(*) FILTER (WHERE packet_loss_percent > 5) as high_loss
        FROM test_results_direct_ping
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      `)
      const p = lossRes.rows[0]
      contextParts.push(`📉 PACKET LOSS (24h): Avg ${p.avg_loss}%, High Loss (>5%): ${p.high_loss} devices`)
    }

    // 5. Offline devices
    if (lowerMsg.includes('offline') || lowerMsg.includes('mati') || lowerMsg.includes('down')) {
      const offRes = await client.query(`
        SELECT serial_number, device_name, ip_address::text,
          COALESCE(ds.name, 'N/A') as region
        FROM devices_ont d
        LEFT JOIN downstream_servers ds ON d.downstream_server_id = ds.id
        WHERE status = 'offline'
        LIMIT 10
      `)
      if (offRes.rows.length > 0) {
        contextParts.push(`🔴 OFFLINE DEVICES: ${offRes.rows.map((r: any) => `${r.serial_number} (${r.region})`).join(', ')}`)
      } else {
        contextParts.push(`🔴 OFFLINE DEVICES: 0 device offline`)
      }
    }

    // 6. Active alarms overview
    if (lowerMsg.includes('alarm') || lowerMsg.includes('masalah') || lowerMsg.includes('penyebab') || lowerMsg.includes('gangguan') || lowerMsg.includes('error') || lowerMsg.includes('kritis') || lowerMsg.includes('critical')) {
      const alarmRes = await client.query(`
        SELECT 
          alarm_type, severity, COUNT(*) as count
        FROM active_alarms
        GROUP BY alarm_type, severity
        ORDER BY COUNT(*) DESC
      `)
      if (alarmRes.rows.length > 0) {
        contextParts.push(`🔔 ACTIVE ALARMS:\n${alarmRes.rows.map((r: any) => `  - ${r.alarm_type.replace(/_/g, ' ')}: ${r.count} (${r.severity})`).join('\n')}`)
      } else {
        contextParts.push(`🔔 ACTIVE ALARMS: 0 active alarms`)
      }
    }

    // 6b. Brands with most alarms
    if (lowerMsg.includes('brand') || lowerMsg.includes('merek') || lowerMsg.includes('vendor') || lowerMsg.includes('manufacturer') || lowerMsg.includes('pabrik')) {
      const brandAlarmRes = await client.query(`
        SELECT 
          d.manufacturer as brand, COUNT(*) as alarm_count,
          COUNT(*) FILTER (WHERE aa.severity = 'critical') as critical_count
        FROM active_alarms aa
        JOIN devices_ont d ON d.id = aa.device_id
        WHERE d.manufacturer IS NOT NULL AND d.manufacturer != ''
        GROUP BY d.manufacturer
        ORDER BY alarm_count DESC
        LIMIT 10
      `)
      if (brandAlarmRes.rows.length > 0) {
        contextParts.push(`🏭 BRANDS BY ALARM COUNT:\n${brandAlarmRes.rows.map((r: any) => `  - ${r.brand}: ${r.alarm_count} alarms (${r.critical_count} critical)`).join('\n')}`)
      }
    }

    // 6c. ONT types with most alarms
    if (lowerMsg.includes('ont type') || lowerMsg.includes('tipe ont') || lowerMsg.includes('cpe type') || lowerMsg.includes('model')) {
      const typeAlarmRes = await client.query(`
        SELECT 
          d.cpe_type as ont_type, COUNT(*) as alarm_count,
          COUNT(*) FILTER (WHERE aa.severity = 'critical') as critical_count
        FROM active_alarms aa
        JOIN devices_ont d ON d.id = aa.device_id
        WHERE d.cpe_type IS NOT NULL AND d.cpe_type != ''
        GROUP BY d.cpe_type
        ORDER BY alarm_count DESC
        LIMIT 10
      `)
      if (typeAlarmRes.rows.length > 0) {
        contextParts.push(`📦 ONT TYPES BY ALARM COUNT:\n${typeAlarmRes.rows.map((r: any) => `  - ${r.ont_type}: ${r.alarm_count} alarms (${r.critical_count} critical)`).join('\n')}`)
      }
    }

    // 6d. Top problematic devices (most alarms)
    if (lowerMsg.includes('device masalah') || lowerMsg.includes('ont masalah') || lowerMsg.includes('problem') || lowerMsg.includes('bermasalah') || lowerMsg.includes('banyak alarm')) {
      const probRes = await client.query(`
        SELECT 
          d.serial_number, d.device_name, d.manufacturer as brand, d.cpe_type as ont_type,
          COUNT(*) as alarm_count,
          COUNT(*) FILTER (WHERE aa.severity = 'critical') as critical_count,
          STRING_AGG(DISTINCT aa.alarm_type, ', ') as alarm_types
        FROM active_alarms aa
        JOIN devices_ont d ON d.id = aa.device_id
        GROUP BY d.id, d.serial_number, d.device_name, d.manufacturer, d.cpe_type
        ORDER BY alarm_count DESC
        LIMIT 5
      `)
      if (probRes.rows.length > 0) {
        contextParts.push(`🚨 TOP PROBLEMATIC DEVICES:\n${probRes.rows.map((r: any) => `  - ${r.serial_number} (${r.brand} ${r.ont_type}): ${r.alarm_count} alarms (${r.critical_count} critical) — ${r.alarm_types}`).join('\n')}`)
      }
    }

    // 6e. Alarm count by region
    if (lowerMsg.includes('daerah') || lowerMsg.includes('alarm per')) {
      const regAlarmRes = await client.query(`
        SELECT 
          COALESCE(ds.name, 'Unknown') as region,
          COUNT(*) as alarm_count
        FROM active_alarms aa
        JOIN devices_ont d ON d.id = aa.device_id
        LEFT JOIN downstream_servers ds ON d.downstream_server_id = ds.id
        GROUP BY ds.name
        ORDER BY alarm_count DESC
      `)
      if (regAlarmRes.rows.length > 0) {
        contextParts.push(`📍 ALARMS BY REGION:\n${regAlarmRes.rows.map((r: any) => `  - ${r.region}: ${r.alarm_count} alarms`).join('\n')}`)
      }
    }

    // 6. Downstream servers (original, renumbered)
    if (lowerMsg.includes('server') || lowerMsg.includes('downstream') || lowerMsg.includes('lokasi')) {
      const srvRes = await client.query(`
        SELECT name, location, province, status, lat, lng
        FROM downstream_servers
        ORDER BY status, province
      `)
      contextParts.push(`🖥️ DOWNSTREAM SERVERS:\n${srvRes.rows.map((r: any) => `  - ${r.name}: ${r.location}, ${r.province} (${r.status})`).join('\n')}`)
    }

    // 8. near IGW/near EBR Ping tests (upstream latency)
    if (lowerMsg.includes('igw') || lowerMsg.includes('ebr') || lowerMsg.includes('upstream')) {
      const pingRes = await client.query(`
        SELECT 
          ROUND(AVG(igw_latency_ms)::numeric, 2) as avg_igw,
          ROUND(AVG(ebr_latency_ms)::numeric, 2) as avg_ebr,
          ROUND(MAX(igw_latency_ms)::numeric, 2) as max_igw,
          ROUND(MAX(ebr_latency_ms)::numeric, 2) as max_ebr,
          COUNT(*) as total_tests
        FROM test_results_ping
        WHERE executed_at >= NOW() - INTERVAL '24 hours'
      `)
      const p = pingRes.rows[0]
      contextParts.push(`🏓 UPSTREAM PING (24h): near IGW avg ${p.avg_igw}ms (max ${p.max_igw}ms), near EBR avg ${p.avg_ebr}ms (max ${p.max_ebr}ms), Total ${p.total_tests} tests`)
    }

    // 9. Upload speed tests
    if (lowerMsg.includes('upload')) {
      const upRes = await client.query(`
        SELECT 
          ROUND(AVG(upload_speed)::numeric, 2) as avg_upload,
          ROUND(MIN(upload_speed)::numeric, 2) as min_upload,
          ROUND(MAX(upload_speed)::numeric, 2) as max_upload,
          COUNT(*) as total_tests
        FROM test_results_speed_upload
        WHERE executed_at >= NOW() - INTERVAL '24 hours'
      `)
      const u = upRes.rows[0]
      contextParts.push(`📤 UPLOAD SPEED (24h): Avg ${u.avg_upload} Mbps, Min ${u.min_upload} Mbps, Max ${u.max_upload} Mbps (${u.total_tests} tests)`)
    }

    // 10. Traceroute results
    if (lowerMsg.includes('traceroute') || lowerMsg.includes('hop') || lowerMsg.includes('routing')) {
      const traceRes = await client.query(`
        SELECT 
          ROUND(AVG(total_hops)::numeric, 1) as avg_hops,
          ROUND(AVG(total_rtt_ms)::numeric, 2) as avg_rtt,
          COUNT(*) FILTER (WHERE success = true) as success_count,
          COUNT(*) FILTER (WHERE success = false) as fail_count
        FROM test_results_traceroute
        WHERE executed_at >= NOW() - INTERVAL '24 hours'
      `)
      const t = traceRes.rows[0]
      contextParts.push(`🛤️ TRACEROUTE (24h): Avg ${t.avg_hops} hops, Avg RTT ${t.avg_rtt}ms, Success ${t.success_count}, Failed ${t.fail_count}`)
    }

    // 11. Regional stats
    if (lowerMsg.includes('regional') || lowerMsg.includes('wilayah') || lowerMsg.includes('area')) {
      const regRes = await client.query(`
        SELECT 
          ds.name as regional,
          COUNT(d.id) as total_devices,
          COUNT(*) FILTER (WHERE d.status = 'online') as online,
          COUNT(*) FILTER (WHERE d.status = 'offline') as offline
        FROM downstream_servers ds
        LEFT JOIN devices_ont d ON d.downstream_server_id = ds.id
        GROUP BY ds.name, ds.id
        ORDER BY total_devices DESC
      `)
      contextParts.push(`🗺️ REGIONAL STATS:\n${regRes.rows.map((r: any) => `  - ${r.regional}: ${r.total_devices} devices (${r.online} online, ${r.offline} offline)`).join('\n')}`)
    }

    // 12. Scheduled tasks status
    if (lowerMsg.includes('task') || lowerMsg.includes('jadwal') || lowerMsg.includes('schedule')) {
      const taskRes = await client.query(`
        SELECT 
          status,
          COUNT(*) as count
        FROM tasks
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY status
        ORDER BY count DESC
      `)
      contextParts.push(`📋 TASKS (7d): ${taskRes.rows.map((r: any) => `${r.status}=${r.count}`).join(', ')}`)
    }

    // 13. Worst performing devices (high latency + packet loss)
    if (lowerMsg.includes('worst') || lowerMsg.includes('buruk') || lowerMsg.includes('terburuk') || lowerMsg.includes('problem')) {
      const worstRes = await client.query(`
        SELECT 
          d.serial_number,
          d.device_name,
          COALESCE(ds.name, 'N/A') as region,
          ROUND(p.avg_latency_ms::numeric, 2) as avg_latency,
          ROUND(p.packet_loss_percent::numeric, 2) as packet_loss
        FROM test_results_direct_ping p
        JOIN devices_ont d ON p.device_id = d.id
        LEFT JOIN downstream_servers ds ON d.downstream_server_id = ds.id
        WHERE p.created_at >= NOW() - INTERVAL '24 hours'
        ORDER BY p.avg_latency_ms DESC
        LIMIT 5
      `)
      if (worstRes.rows.length > 0) {
        contextParts.push(`🚨 WORST PERFORMING DEVICES (24h):\n${worstRes.rows.map((r: any) => `  - ${r.serial_number} (${r.region}): ${r.avg_latency}ms, ${r.packet_loss}% loss`).join('\n')}`)
      }
    }

    client.release()
  } catch (err) {
    console.error('RAG context fetch error:', err)
  }

  return contextParts.join('\n\n')
}

// ── Main Chatbot Handler ──────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const { message, context: userContext } = await request.json()

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    if (!DEEPSEEK_API_KEY) {
      return NextResponse.json(
        { error: 'DEEPSEEK_API_KEY is not configured. Please set it in environment variables.' },
        { status: 500 }
      )
    }

    // Fetch RAG context from database
    const ragContext = await fetchRAGContext(message)

    const systemPrompt = `You are MojoBot, an AI assistant for the MojoJojoMonitor FTTH/ACS monitoring dashboard.

Your job is to help field technicians and network engineers analyze network data, troubleshoot ONT devices, and monitor network health.

## Rules:
1. Always use REAL DATA from the database context provided below
2. If data is not available, say so honestly
3. Be concise but informative (max 3-4 paragraphs)
4. Use Indonesian language if user asks in Indonesian
5. Use English if user asks in English
6. For device troubleshooting, suggest actionable steps
7. Highlight critical issues (high latency, packet loss, offline devices, active alarms)
8. When asked about problematic devices/brands/ONT types, use the alarm data context

## Current Database Context:
${ragContext || 'No data available from database.'}

${userContext ? `## Additional User Context:\n${JSON.stringify(userContext, null, 2)}` : ''}

## Response Guidelines:
- Start with a brief summary
- Use bullet points for lists
- Include specific numbers from the data
- Suggest next steps when appropriate`

    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('DeepSeek API error:', errorData)
      return NextResponse.json(
        { error: `DeepSeek API error: ${response.status}` },
        { status: 500 }
      )
    }

    const data = await response.json()
    const reply = data.choices?.[0]?.message?.content || 'Maaf, saya tidak dapat memproses permintaan Anda saat ini.'

    return NextResponse.json({ response: reply })
  } catch (error: any) {
    console.error('Chatbot error:', error)
    return NextResponse.json(
      { error: 'Failed to process chatbot request: ' + (error.message || 'Unknown error') },
      { status: 500 }
    )
  }
}
