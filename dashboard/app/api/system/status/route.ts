import { NextResponse } from 'next/server'
import { exec, execFile } from 'child_process'
import { promisify } from 'util'
import os from 'os'

const execAsync = promisify(exec)
const execFileAsync = promisify(execFile)

const DOCKER = '/usr/local/bin/docker'

async function getDiskUsage() {
  try {
    const { stdout } = await execAsync("df -h / | tail -1")
    const parts = stdout.trim().split(/\s+/)
    return { size: parts[1], used: parts[2], available: parts[3], percent: parts[4] }
  } catch {
    return { size: 'N/A', used: 'N/A', available: 'N/A', percent: 'N/A' }
  }
}

async function getContainersStats() {
  try {
    const { stdout } = await execFileAsync(DOCKER, [
      'stats', '--no-stream', '--format', '{{json .}}'
    ], { timeout: 15000, maxBuffer: 1024 * 1024 })

    if (!stdout.trim()) return []

    return stdout.trim().split('\n').filter(Boolean).map(line => {
      try {
        const c = JSON.parse(line)
        return {
          name: c.Name.replace(/^\/+/, ''),
          cpu_percent: c.CPUPerc,
          mem_usage: c.MemUsage,
          mem_percent: c.MemPerc,
          net_io: c.NetIO,
          block_io: c.BlockIO,
          pids: c.PIDs
        }
      } catch {
        return null
      }
    }).filter(Boolean)
  } catch (e) {
    console.error('getContainersStats failed:', e instanceof Error ? e.message : String(e))
    return []
  }
}

async function getCpuPercent() {
  try {
    const cpus = os.cpus()
    let idle = 0, total = 0
    for (const cpu of cpus) {
      for (const type in cpu.times) total += cpu.times[type as keyof typeof cpu.times]
      idle += cpu.times.idle
    }
    return {
      cores: cpus.length,
      usage_percent: cpus.length > 0
        ? (100 - (idle / cpus.length / (total / cpus.length) * 100)).toFixed(1)
        : '0',
      loadavg: os.loadavg()
    }
  } catch {
    return { cores: os.cpus().length, usage_percent: '0', loadavg: os.loadavg() }
  }
}

async function getContainerUptimes() {
  try {
    const { stdout } = await execFileAsync(DOCKER, [
      'ps', '--format', '{{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}'
    ])
    if (!stdout.trim()) return []
    return stdout.trim().split('\n').map(line => {
      const [name, status, image, ports] = line.split('\t')
      return { name, status, image: image?.split(':')[0] || image, ports }
    })
  } catch (e) {
    console.error('getContainerUptimes failed:', e instanceof Error ? e.message : String(e))
    return []
  }
}

export async function GET() {
  try {
    const [diskUsage, containers, cpu, containerUptimes] = await Promise.all([
      getDiskUsage(),
      getContainersStats(),
      getCpuPercent(),
      getContainerUptimes()
    ])

    const uptimeMap = new Map(containerUptimes.map(c => [c.name, c]))
    const containersWithInfo = containers.map((c: any) => ({ ...c, ...(uptimeMap.get(c.name) || {}) }))

    const totalMem = os.totalmem()
    const freeMem = os.freemem()

    return NextResponse.json({
      cpu,
      memory: {
        total_gb: (totalMem / 1024 / 1024 / 1024).toFixed(2),
        free_gb: (freeMem / 1024 / 1024 / 1024).toFixed(2),
        used_gb: ((totalMem - freeMem) / 1024 / 1024 / 1024).toFixed(2),
        percent: (100 - (freeMem / totalMem * 100)).toFixed(1)
      },
      disk: diskUsage,
      containers: containersWithInfo,
      host_uptime: os.uptime()
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get system status' }, { status: 500 })
  }
}
