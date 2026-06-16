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
        SELECT serial_number, device_name, ip_address::text, regional_name
        FROM devices_ont
        WHERE status = 'offline'
        LIMIT 10
      `)
      if (offRes.rows.length > 0) {
        contextParts.push(`🔴 OFFLINE DEVICES: ${offRes.rows.map((r: any) => `${r.serial_number} (${r.regional_name || 'N/A'})`).join(', ')}`)
      } else {
        contextParts.push(`🔴 OFFLINE DEVICES: 0 device offline`)
      }
    }

    // 6. Downstream servers
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
          g.name as regional,
          COUNT(d.id) as total_devices,
          COUNT(*) FILTER (WHERE d.status = 'online') as online,
          COUNT(*) FILTER (WHERE d.status = 'offline') as offline
        FROM group_devices g
        LEFT JOIN devices_ont d ON d.regional_id = g.id
        GROUP BY g.name
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
          g.name as regional,
          ROUND(p.avg_latency_ms::numeric, 2) as avg_latency,
          ROUND(p.packet_loss_percent::numeric, 2) as packet_loss
        FROM test_results_direct_ping p
        JOIN devices_ont d ON p.device_id = d.id
        LEFT JOIN group_devices g ON d.regional_id = g.id
        WHERE p.created_at >= NOW() - INTERVAL '24 hours'
        ORDER BY p.avg_latency_ms DESC
        LIMIT 5
      `)
      if (worstRes.rows.length > 0) {
        contextParts.push(`🚨 WORST PERFORMING DEVICES (24h):\n${worstRes.rows.map((r: any) => `  - ${r.serial_number} (${r.regional}): ${r.avg_latency}ms, ${r.packet_loss}% loss`).join('\n')}`)
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
7. Highlight critical issues (high latency, packet loss, offline devices)

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
