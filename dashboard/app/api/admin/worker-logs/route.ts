import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface WorkerContainer {
  id: string
  name: string
  service: string
}

const DIRECT_FILTER_MODE = process.env.WORKER_LOG_FILTER === 'direct'

async function getWorkerContainers(): Promise<WorkerContainer[]> {
  try {
    // Ambil semua container milik project mojo-central yang namanya mengandung "worker".
    // Ini mencakup mojo_worker_fast/download/upload, mojo_direct_ping_worker_*,
    // dan semua replica scaling (mojo_worker_fast-1, mojo_worker_fast-2, dst).
    const { stdout } = await execAsync(
      `docker ps --format '{{.ID}}\t{{.Names}}\t{{.Label "com.docker.compose.service"}}' -f label=com.docker.compose.project=mojo-central`,
      { timeout: 10000 }
    )

    return stdout
      .split('\n')
      .map(line => line.trim())
      .filter(line => line !== '')
      .map(line => {
        const [id, name, service] = line.split('\t')
        return { id: id || '', name: name || '', service: service || '' }
      })
      .filter(c => c.id && (c.name.toLowerCase().includes('worker') || c.name.toLowerCase().includes('fping')))
  } catch (err) {
    console.error('Error listing worker containers:', err)
    return []
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const tail = Math.min(parseInt(searchParams.get('tail') || '100'), 500)
    const since = searchParams.get('since') || ''

    const containers = await getWorkerContainers()

    if (containers.length === 0) {
      return NextResponse.json({
        logs: ['No worker containers found for project mojo-central'],
        total: 1,
        timestamp: new Date().toISOString()
      })
    }

    const logPromises = containers.map(async (container) => {
      try {
        let cmd = `docker logs --tail ${tail} ${container.id} 2>&1`
        if (since) {
          cmd = `docker logs --since "${since}" --tail ${tail} ${container.id} 2>&1`
        }
        const { stdout } = await execAsync(cmd, { timeout: 10000 })
        return stdout
          .split('\n')
          .filter(line => line.trim() !== '')
          .map(line => `[${container.name}] ${line}`)
      } catch (err: any) {
        return [`[${container.name}] ${err.message || 'Unable to fetch logs'}`]
      }
    })

    const allLogs = await Promise.all(logPromises)
    const combinedLines = allLogs.flat()

    // Filter: default ALL lines; set WORKER_LOG_FILTER=direct to see only fping/direct
    const lines = DIRECT_FILTER_MODE
      ? combinedLines.filter(line =>
          ['direct-ping', 'fping', 'saved ping', 'ping cycle', 'next ping'].some(k =>
            line.toLowerCase().includes(k)
          )
        )
      : combinedLines

    return NextResponse.json({
      logs: lines,
      total: lines.length,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('Error fetching worker logs:', error)
    const status = error.message === 'Unauthorized' ? 401 : error.message === 'Forbidden' ? 403 : 500
    return NextResponse.json(
      { error: 'Failed to fetch worker logs', details: error.message },
      { status }
    )
  }
}
