import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { platform, config } = body

    if (!platform || !['telegram', 'whatsapp', 'ticketing'].includes(platform)) {
      return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
    }

    if (!config || typeof config !== 'object') {
      return NextResponse.json({ error: 'Invalid config' }, { status: 400 })
    }

    // Telegram Test
    if (platform === 'telegram') {
      const botToken = config.bot_token
      if (!botToken) {
        return NextResponse.json({ error: 'Bot token wajib diisi' }, { status: 400 })
      }

      // Test getMe first
      const getMeRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, { method: 'POST', signal: AbortSignal.timeout(10000) })
      const getMeData = await getMeRes.json()
      if (!getMeData.ok) {
        return NextResponse.json({ error: `Telegram API error: ${getMeData.description || 'Invalid token'}` }, { status: 400 })
      }

      // If chat_id provided, try sending test message
      const chatId = config.chat_id
      if (chatId) {
        const sendRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: '✅ Test koneksi berhasil dari Mojo-Central!' }),
          signal: AbortSignal.timeout(10000),
        })
        const sendData = await sendRes.json()
        if (!sendData.ok) {
          return NextResponse.json({ error: `Gagal kirim pesan: ${sendData.description || 'Unknown error'}` }, { status: 400 })
        }
      }

      return NextResponse.json({ success: true, botName: getMeData.result?.username })
    }

    // WhatsApp Test
    if (platform === 'whatsapp') {
      const apiUrl = config.api_url
      if (!apiUrl) {
        return NextResponse.json({ error: 'API URL wajib diisi' }, { status: 400 })
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (config.api_key) headers['Authorization'] = config.api_key
      if (config.headers) Object.assign(headers, config.headers)

      let testBody: any = { message: 'Test koneksi dari Mojo-Central' }
      if (config.target_number || config.target) {
        testBody.target = config.target_number || config.target
      }
      if (config.body_template) Object.assign(testBody, config.body_template)

      // Replace any placeholder in body_template for test
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(testBody),
        signal: AbortSignal.timeout(15000),
      })

      if (!res.ok) {
        const text = await res.text()
        return NextResponse.json({ error: `HTTP ${res.status}: ${text.slice(0, 200)}` }, { status: 400 })
      }

      return NextResponse.json({ success: true })
    }

    // Ticketing Test
    if (platform === 'ticketing') {
      const apiUrl = config.api_url
      if (!apiUrl) {
        return NextResponse.json({ error: 'API URL wajib diisi' }, { status: 400 })
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (config.api_key) headers['Authorization'] = config.api_key
      if (config.headers) Object.assign(headers, config.headers)

      const testPayload = {
        event: 'test',
        message: 'Test koneksi dari Mojo-Central',
        timestamp: new Date().toISOString(),
      }

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(15000),
      })

      if (!res.ok) {
        const text = await res.text()
        return NextResponse.json({ error: `HTTP ${res.status}: ${text.slice(0, 200)}` }, { status: 400 })
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown platform' }, { status: 400 })
  } catch (error: any) {
    console.error('Integration test error:', error)
    return NextResponse.json({ error: error.message || 'Test failed' }, { status: 500 })
  }
}
