'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Server, Database, Cpu, Wifi, Activity, Clock, MapPin, HardDrive } from 'lucide-react'

interface WorkerInfo {
  id: string
  queue: string
  lastHeartbeat: string
  concurrency: number
}

interface QueueStats {
  waiting: number
  active: number
}

interface RegionalInfo {
  name: string
  status: string
  pings_30min: number
  last_ping: string | null
}

interface HealthData {
  status: string
  timestamp: string
  services: { database: string; redis: string }
  workers: { total: number; active: number; list: WorkerInfo[]; queues: Record<string, QueueStats> }
  dispatcher: { status: string; recent_jobs_5min: number; note: string }
  regional: Record<string, RegionalInfo>
  uptime: number
}

export default function HealthPage() {
  const [data, setData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchHealth = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/health')
      if (!res.ok && res.status !== 503) throw new Error('Failed to fetch')
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchHealth() }, [])

  const statusIcon = (s: string) => {
    if (s === 'ok') return <CheckCircle className="w-5 h-5 text-green-400" />
    if (s === 'degraded' || s === 'idle' || s === 'no_ping_30min') return <AlertTriangle className="w-5 h-5 text-yellow-400" />
    return <XCircle className="w-5 h-5 text-red-400" />
  }

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      ok: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
      degraded: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
      idle: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
      no_ping_30min: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
      error: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    }
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[s] || 'bg-gray-100 text-gray-600'}`}>
        {s}
      </span>
    )
  }

  const card = (title: string, icon: React.ReactNode, children: React.ReactNode, className = '') => (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-4 text-gray-900 dark:text-white font-semibold text-sm uppercase tracking-wide">
        {icon}
        {title}
      </div>
      {children}
    </div>
  )

  return (
    <div className="min-h-screen p-8 bg-white/90 dark:bg-gray-800/90">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">System Health</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Last check: {data ? new Date(data.timestamp).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '-'}
          </p>
        </div>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading && !data && (
        <div className="text-center py-20 text-gray-500 dark:text-gray-400">
          <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin" />
          Loading health data...
        </div>
      )}

      {error && (
        <div className="text-center py-20">
          <XCircle className="w-12 h-12 mx-auto mb-3 text-red-400" />
          <p className="text-red-500 dark:text-red-400">{error}</p>
          <button onClick={fetchHealth} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">
            Retry
          </button>
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Overall Status */}
          <div className={`rounded-lg p-6 ${data.status === 'ok' ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : data.status === 'degraded' ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
            <div className="flex items-center gap-3">
              {data.status === 'ok' ? <CheckCircle className="w-8 h-8 text-green-500" /> : data.status === 'degraded' ? <AlertTriangle className="w-8 h-8 text-yellow-500" /> : <XCircle className="w-8 h-8 text-red-500" />}
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white capitalize">System Status: {data.status}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Uptime: {Math.floor(data.uptime / 60)}m {Math.floor(data.uptime % 60)}s</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {/* Core Services */}
            {card('Core Services', <Server className="w-4 h-4" />, (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-blue-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">PostgreSQL</span>
                  </div>
                  {statusIcon(data.services.database)}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Redis</span>
                  </div>
                  {statusIcon(data.services.redis)}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-purple-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Dispatcher</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusIcon(data.dispatcher.status)}
                    <span className="text-xs text-gray-500">{data.dispatcher.recent_jobs_5min} jobs/5m</span>
                  </div>
                </div>
              </div>
            ))}

            {/* Workers */}
            {card('Workers', <Activity className="w-4 h-4" />, (
              <div>
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-bold text-green-500">{data.workers.active}</span> / {data.workers.total} active
                  </span>
                  <span className="text-xs text-gray-500">Heartbeat &lt; 2m</span>
                </div>
                <div className="space-y-2">
                  {data.workers.list.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">No active workers</p>
                  ) : data.workers.list.map((w, i) => (
                    <div key={i} className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-700/50 rounded px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                        <span className="text-gray-700 dark:text-gray-300 truncate text-xs font-mono">{w.id.split('-').slice(0, 2).join('-')}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-gray-500">{w.queue}</span>
                        <span className="text-xs text-gray-400">{w.concurrency}x</span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Queue Stats */}
                {Object.keys(data.workers.queues).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-xs font-medium text-gray-500 mb-2">Queue Depth</p>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(data.workers.queues).map(([name, q]) => (
                        <div key={name} className="flex justify-between text-xs bg-gray-50 dark:bg-gray-700/50 rounded px-2 py-1.5">
                          <span className="text-gray-600 dark:text-gray-400">{name.replace('acs-', '')}</span>
                          <span className="text-gray-900 dark:text-white font-medium">{q.waiting + q.active}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Uptime */}
            {card('System Uptime', <Clock className="w-4 h-4" />, (
              <div className="text-center py-4">
                <p className="text-4xl font-bold text-gray-900 dark:text-white mb-1">{Math.floor(data.uptime / 60)}m</p>
                <p className="text-sm text-gray-500">Dashboard container uptime</p>
              </div>
            ))}
          </div>

          {/* Regional Workers */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
            <div className="flex items-center gap-2 mb-4 text-gray-900 dark:text-white font-semibold text-sm uppercase tracking-wide">
              <MapPin className="w-4 h-4" /> Regional Workers
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {Object.entries(data.regional).map(([key, r]) => (
                <div key={key} className={`rounded-lg border p-4 ${r.status === 'ok' ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' : 'bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-700'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{r.name}</span>
                    {statusBadge(r.status === 'ok' ? 'ok' : 'offline')}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                    <p>Pings (30m): <span className="font-medium text-gray-700 dark:text-gray-300">{r.pings_30min}</span></p>
                    <p>Last ping: <span className="font-medium text-gray-700 dark:text-gray-300">{r.last_ping ? new Date(r.last_ping).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '-'}</span></p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Raw JSON */}
          <details className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
            <summary className="text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer select-none">
              Raw Response
            </summary>
            <pre className="mt-3 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg overflow-x-auto max-h-96">
              {JSON.stringify(data, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  )
}
