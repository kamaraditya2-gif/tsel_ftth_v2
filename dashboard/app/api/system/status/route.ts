import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import os from 'os'

export async function GET() {
  try {
    // Get disk usage (Linux command)
    const diskUsage = await new Promise((resolve) => {
      exec('df -h / | tail -1', (err, stdout) => {
        if (err) {
          resolve({ percent: 'N/A', available: 'N/A' })
          return
        }
        const parts = stdout.trim().split(/\s+/)
        resolve({
          size: parts[1],
          used: parts[2],
          available: parts[3],
          percent: parts[4]
        })
      })
    })

    return NextResponse.json({
      uptime: os.uptime(),
      load: os.loadavg(),
      memory: {
        total: (os.totalmem() / 1024 / 1024 / 1024).toFixed(2) + ' GB',
        free: (os.freemem() / 1024 / 1024 / 1024).toFixed(2) + ' GB'
      },
      disk: diskUsage,
      systemTime: new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Jakarta'
      })
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get system status' },
      { status: 500 }
    )
  }
}
