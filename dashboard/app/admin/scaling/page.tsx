'use client'

import { useState, useEffect } from 'react'
import { Layers, Plus, Minus, Power, RotateCcw, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { useRequireAdmin } from '@/hooks/useRequireAdmin'
import RegionalStatusCards from '@/components/RegionalStatusCards'

interface ContainerInfo {
  id: string
  name: string
  status: string
  image: string
  created: string
}

interface ServiceInfo {
  name: string
  label: string
  running: number
  total: number
  containers: ContainerInfo[]
}

function getServiceLabel(name: string): string {
  if (name.startsWith('mojo_direct_ping_worker_')) {
    const region = name.replace('mojo_direct_ping_worker_', '')
    if (region === 'default') return 'Direct Ping — Default'
    return `Direct Ping — ${region.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`
  }
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
}

function getServiceDescription(name: string): string {
  if (name === 'mojo_worker_fast') return 'ACS ping, traceroute, ONT status'
  if (name === 'mojo_worker_download') return 'ACS download speed tests'
  if (name === 'mojo_worker_upload') return 'ACS upload speed tests'
  if (name.startsWith('mojo_direct_ping_worker_')) {
    const region = name.replace('mojo_direct_ping_worker_', '')
    return region === 'default'
      ? 'Direct ICMP ping for all unmapped ONTs'
      : `Regional ICMP ping (${region.replace(/_/g, ' ')})`
  }
  return 'Worker service'
}

export default function ScalingPage() {
  useRequireAdmin()

  const [services, setServices] = useState<ServiceInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [scaling, setScaling] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/admin/scaling')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch status')
      setServices(data.services || [])
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleScale = async (serviceName: string, replicas: number) => {
    setScaling(serviceName)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/admin/scaling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: serviceName, replicas })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Scaling failed')
      setSuccess(`${data.service}: scaled from ${data.previousReplicas} to ${data.actualReplicas} replicas`)
      await fetchStatus()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setScaling(null)
    }
  }

  const getServiceColor = (name: string) => {
    if (name.includes('fast')) return 'border-blue-500/30 bg-blue-500/10'
    if (name.includes('download')) return 'border-purple-500/30 bg-purple-500/10'
    if (name.includes('upload')) return 'border-orange-500/30 bg-orange-500/10'
    if (name.includes('direct_ping_worker_default')) return 'border-green-500/30 bg-green-500/10'
    return 'border-emerald-500/30 bg-emerald-500/10'
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-gray-400">Loading scaling status...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Layers className="w-8 h-8 text-cyan-400" />
          Worker Scaling
        </h1>
        <p className="text-gray-400">
          Scale worker containers up or down based on the number of ONTs. Resize VM flavor first, then add replicas.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-300 flex items-center gap-3">
          <CheckCircle className="w-5 h-5" />
          {success}
        </div>
      )}

      <RegionalStatusCards />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {services.map((service) => (
          <div
            key={service.name}
            className={`rounded-2xl border backdrop-blur-md p-6 shadow-lg transition-all hover:-translate-y-1 ${getServiceColor(service.name)}`}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">{getServiceLabel(service.name)}</h3>
                <p className="text-sm text-gray-400">{getServiceDescription(service.name)}</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-white">{service.running}</div>
                <div className="text-xs text-gray-400">running replicas</div>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                {service.running} running
                {service.total > service.running && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-gray-500 ml-2" />
                    {service.total - service.running} stopped
                  </>
                )}
              </div>
              {service.containers.length > 0 && (
                <div className="text-xs text-gray-500 space-y-1">
                  {service.containers.slice(0, 3).map((c) => (
                    <div key={c.id} className="truncate">
                      {c.name} — {c.status}
                    </div>
                  ))}
                  {service.containers.length > 3 && (
                    <div className="text-gray-600">+{service.containers.length - 3} more</div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleScale(service.name, Math.max(0, service.running - 1))}
                disabled={scaling === service.name || service.running === 0}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Decrease by 1"
              >
                <Minus className="w-5 h-5" />
              </button>

              <button
                onClick={() => handleScale(service.name, service.running + 1)}
                disabled={scaling === service.name}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Increase by 1"
              >
                <Plus className="w-5 h-5" />
              </button>

              <button
                onClick={() => handleScale(service.name, 1)}
                disabled={scaling === service.name || service.running === 1}
                className="px-3 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Start 1
              </button>

              <button
                onClick={() => handleScale(service.name, 0)}
                disabled={scaling === service.name || service.running === 0}
                className="px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Stop All
              </button>

              {scaling === service.name && (
                <Loader2 className="w-5 h-5 text-cyan-400 animate-spin ml-auto" />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md">
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-cyan-400" />
          Scaling Guidelines
        </h3>
        <ul className="space-y-2 text-sm text-gray-400">
          <li>• Resize VM flavor (CPU/RAM) first before adding many replicas.</li>
          <li>• Each worker container handles roughly ~5,000 ONTs comfortably.</li>
          <li>• For 26,000 ONTs: start with 6 fast workers, 3 download, 3 upload, 2-5 direct ping.</li>
          <li>• Monitor queue depth in <a href="/admin/worker" className="text-cyan-400 hover:underline">Worker Monitor</a> before scaling.</li>
          <li>• Direct Ping workers can also be deployed regionally per POP/downstream server.</li>
        </ul>
      </div>
    </div>
  )
}
