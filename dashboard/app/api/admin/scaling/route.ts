import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { readFileSync } from 'fs'
import { requireAdmin } from '@/lib/auth'

const execAsync = promisify(exec)

const COMPOSE_FILE = '/app/docker-compose.scaling.yml'

function loadScalableServices(): string[] {
  try {
    const content = readFileSync(COMPOSE_FILE, 'utf-8')
    const services: string[] = []
    const lines = content.split('\n')
    for (const line of lines) {
      // Match top-level service names: two spaces + name + colon
      const match = line.match(/^  ([a-z0-9_][a-z0-9_-]*):\s*$/)
      if (match && match[1] !== 'networks' && match[1] !== 'volumes') {
        services.push(match[1])
      }
    }
    return services
  } catch (error) {
    console.error('Failed to load scalable services from compose file:', error)
    return [
      'mojo_worker_fast',
      'mojo_worker_download',
      'mojo_worker_upload',
      'mojo_direct_ping_worker_default'
    ]
  }
}

// SCALABLE_SERVICES is loaded lazily inside the handlers so that the compose
// file does not need to exist during the Next.js build (it is mounted at runtime).

interface ContainerInfo {
  id: string
  name: string
  status: string
  image: string
  created: string
}

async function getContainersByService(service: string): Promise<ContainerInfo[]> {
  try {
    const { stdout } = await execAsync(
      `docker ps -a --format '{{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Image}}\t{{.CreatedAt}}' -f label=com.docker.compose.service=${service}`,
      { timeout: 10000 }
    )
    return stdout.split('\n')
      .filter(line => line.trim() !== '')
      .map(line => {
        const [id, name, status, image, ...createdParts] = line.split('\t')
        return {
          id: id || '',
          name: name || '',
          status: status || '',
          image: image || '',
          created: createdParts.join('\t') || ''
        }
      })
  } catch (err) {
    return []
  }
}

async function getCurrentReplicas(service: string): Promise<number> {
  const containers = await getContainersByService(service)
  return containers.filter(c => c.status.includes('Up')).length
}

export async function GET() {
  try {
    await requireAdmin()

    const scalableServices = loadScalableServices()
    const services = await Promise.all(
      scalableServices.map(async (service) => {
        const containers = await getContainersByService(service)
        const running = containers.filter(c => c.status.includes('Up')).length
        const total = containers.length
        return {
          name: service,
          label: service.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          running,
          total,
          containers
        }
      })
    )

    return NextResponse.json({ services })
  } catch (error: any) {
    console.error('Scaling status error:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json(
      { error: 'Failed to get scaling status', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()
    const { service, replicas } = body

    const scalableServices = loadScalableServices()
    if (!service || !scalableServices.includes(service)) {
      return NextResponse.json(
        { error: 'Invalid or unsupported service', allowed: scalableServices },
        { status: 400 }
      )
    }

    const targetReplicas = parseInt(replicas)
    if (isNaN(targetReplicas) || targetReplicas < 0 || targetReplicas > 50) {
      return NextResponse.json(
        { error: 'Replicas must be between 0 and 50' },
        { status: 400 }
      )
    }

    const currentReplicas = await getCurrentReplicas(service)

    if (targetReplicas === currentReplicas) {
      return NextResponse.json({
        service,
        replicas: currentReplicas,
        message: `Service ${service} already has ${currentReplicas} replicas`
      })
    }

    // Scale the service using docker-compose
    const cmd = targetReplicas === 0
      ? `docker-compose -f ${COMPOSE_FILE} stop ${service}`
      : `docker-compose -f ${COMPOSE_FILE} up -d --scale ${service}=${targetReplicas} ${service}`

    const { stdout, stderr } = await execAsync(cmd, { timeout: 120000 })

    const newReplicas = await getCurrentReplicas(service)

    return NextResponse.json({
      service,
      previousReplicas: currentReplicas,
      requestedReplicas: targetReplicas,
      actualReplicas: newReplicas,
      command: cmd,
      output: stdout,
      stderr: stderr || null
    })
  } catch (error: any) {
    console.error('Scaling action error:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json(
      { error: 'Failed to scale service', details: error.message },
      { status: 500 }
    )
  }
}
