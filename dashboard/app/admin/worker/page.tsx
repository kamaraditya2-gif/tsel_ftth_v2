'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Activity, CheckCircle, XCircle, Clock, Server, RefreshCw, Zap, Terminal, Pause, Play } from 'lucide-react'
import { useRequireAdmin } from '@/hooks/useRequireAdmin'
import RegionalStatusCards from '@/components/RegionalStatusCards'

interface QueueStat {
  name: string
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
  paused: boolean
  total: number
  exists: boolean
}

interface WorkerStatus {
  status: string
  queues: QueueStat[]
  aggregated: {
    waiting: number
    active: number
    completed: number
    failed: number
    delayed: number
    total: number
    allJobs?: number
  }
  workers: {
    count: number
    list: string[]
  }
  workerDetails?: Array<{
    id: string
    status: string
    lastHeartbeat: string
    concurrency: number
    queue: string
  }>
}

interface Job {
  id: string
  queue: string
  data: any
  deviceInfo?: {
    serial_number: string
    indihome_id: string
  }
  result?: any
  failedReason?: string
  progress?: any
  state: string
  timestamp?: number | null
  processedOn?: number | null
  finishedOn?: number | null
  processedBy?: string | null
}

export default function WorkerPage() {
  useRequireAdmin()
  
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJobState, setSelectedJobState] = useState('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [workerLogs, setWorkerLogs] = useState<string[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const [selectedLogTab, setSelectedLogTab] = useState('all')
  const [regionalLogs, setRegionalLogs] = useState<string[]>([])
  const logsEndRef = useRef<HTMLDivElement>(null)

  const LOG_TABS = [
    { id: 'all', label: 'All', color: 'text-gray-300' },
    { id: 'fping', label: 'FPING', color: 'text-rose-400' },
    { id: 'fast', label: 'FAST', color: 'text-blue-400' },
    { id: 'dl', label: 'DL', color: 'text-purple-400' },
    { id: 'ul', label: 'UL', color: 'text-amber-400' },
    { id: 'regional', label: 'REGIONAL', color: 'text-emerald-400' },
  ]

  const getContainerType = (line: string): string | null => {
    if (!line.startsWith('[')) return null
    const match = line.match(/^\[([^\]]+)\]/)
    if (!match) return null
    const name = match[1]
    if (name.includes('direct_ping')) return 'fping'
    if (name.includes('fast')) return 'fast'
    if (name.includes('download')) return 'dl'
    if (name.includes('upload')) return 'ul'
    return null
  }

  const filteredLogs = useMemo(() =>
    selectedLogTab === 'all' ? workerLogs
    : selectedLogTab === 'regional' ? regionalLogs
    : workerLogs.filter(l => getContainerType(l) === selectedLogTab),
    [workerLogs, regionalLogs, selectedLogTab]
  )

  useEffect(() => {
    fetchWorkerStatus()
    fetchJobs()
    fetchWorkerLogs()
    fetchRegionalLogs()
    const interval = setInterval(() => {
      fetchWorkerStatus()
      fetchJobs()
      if (!isPaused) fetchWorkerLogs()
      if (!isPaused) fetchRegionalLogs()
    }, 3000)

    return () => clearInterval(interval)
  }, [selectedJobState, isPaused])

  const fetchWorkerStatus = async () => {
    try {
      const response = await fetch('/api/admin/worker/status')
      const data = await response.json()
      setWorkerStatus(data)
    } catch (error) {
      console.error('Failed to fetch worker status:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchJobs = async () => {
    try {
      const response = await fetch(`/api/admin/worker/jobs?limit=10&state=${selectedJobState}`)
      const data = await response.json()
      setJobs(data.jobs || [])
    } catch (error) {
      console.error('Failed to fetch jobs:', error)
    }
  }

  const fetchWorkerLogs = async () => {
    try {
      setLogsLoading(true)
      const response = await fetch('/api/admin/worker-logs?tail=200')
      const data = await response.json()
      if (data.logs) {
        setWorkerLogs(data.logs)
      }
    } catch (error) {
      console.error('Failed to fetch worker logs:', error)
    } finally {
      setLogsLoading(false)
    }
  }

  const fetchRegionalLogs = async () => {
    try {
      const response = await fetch('/api/admin/worker/regional-logs')
      const data = await response.json()
      if (data.logs) {
        setRegionalLogs(data.logs)
      }
    } catch (error) {
      console.error('Failed to fetch regional logs:', error)
    }
  }

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [workerLogs, autoScroll])

  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([fetchWorkerStatus(), fetchJobs(), fetchWorkerLogs()])
    setRefreshing(false)
  }

  const getContainerBadge = (line: string) => {
    if (!line.startsWith('[')) return null
    const match = line.match(/^\[([^\]]+)\]/)
    if (!match) return null
    const name = match[1]
    if (name.includes('direct_ping')) return { label: 'FPING', color: 'bg-rose-600 text-white' }
    if (name.includes('fast')) return { label: 'FAST', color: 'bg-blue-600 text-white' }
    if (name.includes('download')) return { label: 'DL', color: 'bg-purple-600 text-white' }
    if (name.includes('upload')) return { label: 'UL', color: 'bg-amber-600 text-white' }
    return { label: 'WORKER', color: 'bg-gray-600 text-white' }
  }

  const getLogColor = (line: string) => {
    const lower = line.toLowerCase()
    if (lower.includes('error') || lower.includes('fail')) return 'text-red-400'
    if (lower.includes('success') || lower.includes('completed') || lower.includes('saved')) return 'text-green-400'
    if (lower.includes('request') || lower.includes('url') || lower.includes('data:')) return 'text-cyan-400'
    if (lower.includes('response') || lower.includes('status')) return 'text-yellow-400'
    if (lower.includes('speed=') || lower.includes('ticket_id')) return 'text-purple-400'
    if (lower.includes('heartbeat')) return 'text-gray-500'
    if (lower.includes('[reg') || lower.includes('[pusat')) return 'text-emerald-400'
    return 'text-gray-300'
  }

  const getQueueColor = (name: string) => {
    if (name.includes('fast')) return 'text-blue-400 border-blue-500/20 bg-blue-500/10'
    if (name.includes('download')) return 'text-purple-400 border-purple-500/20 bg-purple-500/10'
    if (name.includes('upload')) return 'text-orange-400 border-orange-500/20 bg-orange-500/10'
    return 'text-gray-400 border-gray-500/20 bg-gray-500/10'
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-gray-400">Loading worker status...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Worker Monitor</h1>
        <p className="text-gray-400">Monitor and manage 3 parallel BullMQ worker instances</p>
      </div>

      {/* Overall Status */}
      <div className={`mb-6 p-4 rounded-2xl border backdrop-blur-md ${
        workerStatus?.status === 'running' 
          ? 'bg-green-500/10 border-green-500/30' 
          : 'bg-red-500/10 border-red-500/30'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {workerStatus?.status === 'running' ? (
              <Activity className="w-6 h-6 text-green-400 animate-pulse" />
            ) : (
              <XCircle className="w-6 h-6 text-red-400" />
            )}
            <div>
              <p className={`font-semibold ${
                workerStatus?.status === 'running' 
                  ? 'text-green-300' 
                  : 'text-red-300'
              }`}>
                Workers {workerStatus?.status === 'running' ? 'Running' : 'Stopped'}
              </p>
              <p className="text-sm text-gray-400">
                {workerStatus?.workers?.count || 0} active workers across {workerStatus?.queues?.length || 0} queues
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-300"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {workerStatus && (
        <>
          {/* Aggregated Queue Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-md p-5 shadow-lg shadow-blue-500/10 hover:shadow-xl hover:shadow-blue-500/20 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-5 h-5 text-blue-400" />
                <p className="text-xs font-medium text-blue-300 uppercase tracking-wider">Waiting</p>
              </div>
              <p className="text-3xl font-bold text-white">
                {workerStatus.aggregated?.waiting || 0}
              </p>
              <p className="text-xs text-gray-400 mt-1">Jobs in queue</p>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-yellow-500/20 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-md p-5 shadow-lg shadow-yellow-500/10 hover:shadow-xl hover:shadow-yellow-500/20 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-20 h-20 bg-yellow-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              <div className="flex items-center gap-3 mb-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                <p className="text-xs font-medium text-yellow-300 uppercase tracking-wider">Active</p>
              </div>
              <p className="text-3xl font-bold text-white">
                {workerStatus.aggregated?.active || 0}
              </p>
              <p className="text-xs text-gray-400 mt-1">Processing now</p>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-green-500/20 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-md p-5 shadow-lg shadow-green-500/10 hover:shadow-xl hover:shadow-green-500/20 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <p className="text-xs font-medium text-green-300 uppercase tracking-wider">Completed</p>
              </div>
              <p className="text-3xl font-bold text-white">
                {workerStatus.aggregated?.completed || 0}
              </p>
              <p className="text-xs text-gray-400 mt-1">Successfully done</p>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-red-500/20 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-md p-5 shadow-lg shadow-red-500/10 hover:shadow-xl hover:shadow-red-500/20 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-20 h-20 bg-red-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              <div className="flex items-center gap-3 mb-2">
                <XCircle className="w-5 h-5 text-red-400" />
                <p className="text-xs font-medium text-red-300 uppercase tracking-wider">Failed</p>
              </div>
              <p className="text-3xl font-bold text-white">
                {workerStatus.aggregated?.failed || 0}
              </p>
              <p className="text-xs text-gray-400 mt-1">Failed jobs</p>
            </div>
          </div>

          {/* Per-Queue Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {workerStatus.queues?.map((queue) => (
              <div key={queue.name} className={`rounded-2xl border backdrop-blur-md p-5 shadow-lg transition-all duration-300 hover:-translate-y-1 ${getQueueColor(queue.name)}`}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-white capitalize">{queue.name.replace('acs-', '')}</h4>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/80">
                    {queue.total} total
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Waiting</span>
                    <span className="text-white font-medium">{queue.waiting}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Active</span>
                    <span className="text-white font-medium">{queue.active}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Completed</span>
                    <span className="text-white font-medium">{queue.completed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Failed</span>
                    <span className="text-white font-medium">{queue.failed}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Worker Details */}
          {workerStatus.workerDetails && workerStatus.workerDetails.length > 0 && (
            <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-md mb-8 shadow-lg shadow-purple-500/10 overflow-hidden">
              <div className="p-6 border-b border-purple-500/20">
                <h3 className="text-lg font-semibold text-white">Active Workers</h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {workerStatus.workerDetails.map((worker, index) => (
                    <div key={index} className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div>
                          <p className="text-sm text-gray-400 mb-1">Worker ID</p>
                          <p className="text-sm font-mono text-white break-all">
                            {worker.id}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400 mb-1">Queue</p>
                          <p className="text-sm font-medium text-cyan-400">
                            {worker.queue}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400 mb-1">Status</p>
                          <p className="text-sm font-medium text-green-400">
                            {worker.status}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400 mb-1">Last Heartbeat</p>
                          <p className="text-sm text-white">
                            {(() => {
                              const date = new Date(worker.lastHeartbeat)
                              if (isNaN(date.getTime())) return '-'
                              return date.toLocaleString('id-ID', {
                                timeZone: 'Asia/Jakarta',
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: false,
                              }) + ' WIB'
                            })()}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400 mb-1">Concurrency</p>
                          <p className="text-sm text-white">
                            {worker.concurrency}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Regional Status Cards */}
          <RegionalStatusCards />

          {/* Worker Terminal */}
          <div className="bg-gray-900 rounded-xl border border-gray-700 mb-8 overflow-hidden">
            <div className="p-4 border-b border-gray-700 flex flex-col gap-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <Terminal className="w-5 h-5 text-green-400" />
                  <h3 className="text-lg font-semibold text-white">Worker Terminal</h3>
                  <span className="text-xs text-gray-500">Real-time logs from all worker containers</span>
                </div>
                <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPaused(!isPaused)}
                  className={`px-3 py-1 rounded text-xs font-medium transition ${
                    isPaused 
                      ? 'bg-yellow-600 text-white' 
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {isPaused ? <Play className="w-3 h-3 inline mr-1" /> : <Pause className="w-3 h-3 inline mr-1" />}
                  {isPaused ? 'Resume' : 'Pause'}
                </button>
                <button
                  onClick={fetchWorkerLogs}
                  disabled={logsLoading}
                  className="px-3 py-1 rounded text-xs font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 inline mr-1 ${logsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoScroll}
                    onChange={(e) => setAutoScroll(e.target.checked)}
                    className="rounded"
                  />
                  Auto-scroll
                </label>
              </div>
              </div>
              {/* Terminal tabs */}
              <div className="flex gap-1">
                {LOG_TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedLogTab(tab.id)}
                    className={`px-3 py-1.5 rounded text-xs font-bold tracking-wider transition-all ${
                      selectedLogTab === tab.id
                        ? 'bg-white/10 text-white shadow-sm'
                        : `${tab.color} hover:bg-white/5`
                    }`}
                  >
                    {tab.label}
                    {tab.id !== 'all' && (
                      <span className="ml-1.5 opacity-60">
                        ({tab.id === 'regional' ? regionalLogs.length : workerLogs.filter(l => getContainerType(l) === tab.id).length})
                      </span>
                    )}
                  </button>
                ))}
                {selectedLogTab !== 'all' && (
                  <span className="text-[10px] text-gray-600 self-center ml-2">
                    {filteredLogs.length} lines
                  </span>
                )}
              </div>
            </div>
            <div className="p-4 h-96 overflow-y-auto font-mono text-xs leading-relaxed custom-scrollbar">
              {filteredLogs.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No logs available</p>
              ) : (
                filteredLogs.map((line, index) => {
                  const badge = selectedLogTab === 'regional' ? null : getContainerBadge(line)
                  const content = selectedLogTab === 'regional' ? line : (badge ? line.replace(/^\[[^\]]+\]\s*/, '') : line)
                  return (
                    <div key={index} className="flex items-start gap-1.5 mb-0.5">
                      {badge && (
                        <span className={`shrink-0 inline-block px-1.5 py-0.5 rounded text-[10px] font-bold leading-none ${badge.color}`}>
                          {badge.label}
                        </span>
                      )}
                      <span className={`${getLogColor(line)} break-all`}>
                        {content}
                      </span>
                    </div>
                  )
                })
              )}
              <div ref={logsEndRef} />
            </div>
            <div className="px-4 py-2 border-t border-gray-700 bg-gray-800 text-xs text-gray-500 flex justify-between">
              <span>{filteredLogs.length} / {workerLogs.length} lines</span>
              <span>{isPaused ? 'Paused' : 'Live'} • Updates every 3s</span>
            </div>
          </div>

          {/* Recent Jobs */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Jobs</h3>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { key: 'all', label: 'All', count: workerStatus?.aggregated?.allJobs || 0 },
                    { key: 'active', label: 'Active', count: workerStatus?.aggregated?.active || 0 },
                    { key: 'completed', label: 'Completed', count: workerStatus?.aggregated?.completed || 0 },
                    { key: 'failed', label: 'Failed', count: workerStatus?.aggregated?.failed || 0 },
                  ].map(({ key, label, count }) => (
                    <button
                      key={key}
                      onClick={() => setSelectedJobState(key)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        selectedJobState === key
                          ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                          : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                      }`}
                    >
                      {label} <span className="opacity-70">({count})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-purple-500/10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">Job ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">Queue</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">Device SN</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">Indihome ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">Test Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">State</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">Worker</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">Timestamp</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-purple-300 uppercase tracking-wider">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-500/10">
                  {jobs.map((job, index) => (
                    <tr key={index} className="hover:bg-purple-500/5 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-white">
                        {job.id}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getQueueColor(job.queue || '')}`}>
                          {(job.queue || '').replace('acs-', '')}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                        {job.deviceInfo?.serial_number || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                        {job.deviceInfo?.indihome_id || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                        {job.data?.testType || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          job.state === 'completed'
                            ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                            : job.state === 'failed'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : job.state === 'active'
                            ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                            : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                        }`}>
                          {job.state}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                        <span className="font-mono text-xs break-all" title={job.processedBy || undefined}>
                          {job.processedBy ? job.processedBy.split('-').pop() : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                        {(() => {
                          const ts = job.finishedOn || job.processedOn || job.timestamp
                          if (!ts) return '-'
                          const date = new Date(ts)
                          if (isNaN(date.getTime())) return '-'
                          return date.toLocaleString('id-ID', {
                            timeZone: 'Asia/Jakarta',
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false,
                          }) + ' WIB'
                        })()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                        {job.progress ? `${job.progress}%` : '-'}
                      </td>
                    </tr>
                  ))}
                  {jobs.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                        No jobs found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
