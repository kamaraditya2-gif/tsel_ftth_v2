'use client'

import { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { Bell, AlertTriangle, CheckCircle, Search, RefreshCw, ChevronLeft, ChevronRight, Filter, MessageCircle, Send, Ticket, Link2, Unlink, Settings } from 'lucide-react'
import IntegrationConfigModal from './IntegrationConfigModal'

interface Alarm {
  id: number
  device_id: number
  device_name: string
  serial_number: string
  cpe_type: string
  device_status: string
  alarm_type: string
  metric_value: number
  threshold_value: number
  severity: string
  message: string
  triggered_at: string
  last_checked_at?: string
  cleared_at?: string
  cleared_value?: number
  duration_seconds?: number
  run_id: string
}

interface Pagination {
  total: number
  limit: number
  offset: number
}

const alarmTypeLabels: Record<string, string> = {
  upload: 'Upload Speed',
  download: 'Download Speed',
  latency: 'Latency',
}

const alarmTypeColors: Record<string, string> = {
  upload: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  download: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  latency: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
}

export default function AlarmsPage() {
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active')
  const [alarms, setAlarms] = useState<Alarm[]>([])
  const [pagination, setPagination] = useState<Pagination>({ total: 0, limit: 25, offset: 0 })
  const [loading, setLoading] = useState(false)
  const [alarmTypeFilter, setAlarmTypeFilter] = useState('')
  const [deviceSearch, setDeviceSearch] = useState('')
  const [timeRange, setTimeRange] = useState('24h')
  const [integrations, setIntegrations] = useState<any[]>([])
  const [selectedIntegration, setSelectedIntegration] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations')
      const data = await res.json()
      setIntegrations(data.data || [])
    } catch (err) {
      console.error('Fetch integrations error:', err)
    }
  }, [])

  const handleSaveIntegration = async (platform: string, status: string, config: any) => {
    const res = await fetch('/api/integrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, status, config }),
    })
    if (!res.ok) throw new Error('Failed to save')
    await fetchIntegrations()
  }

  const fetchAlarms = useCallback(async () => {
    setLoading(true)
    try {
      const baseUrl = activeTab === 'active' ? '/api/alarms/active' : '/api/alarms/history'
      const params = new URLSearchParams()
      if (alarmTypeFilter) params.set('alarmType', alarmTypeFilter)
      if (deviceSearch) params.set('deviceSearch', deviceSearch)
      if (activeTab === 'history') params.set('timeRange', timeRange)
      params.set('limit', String(pagination.limit))
      params.set('offset', String(pagination.offset))

      const res = await fetch(`${baseUrl}?${params.toString()}`)
      const data = await res.json()
      setAlarms(data.data || [])
      setPagination(data.pagination || { total: 0, limit: 25, offset: 0 })
    } catch (err) {
      console.error('Fetch alarms error:', err)
    } finally {
      setLoading(false)
    }
  }, [activeTab, alarmTypeFilter, deviceSearch, timeRange, pagination.limit, pagination.offset])

  useEffect(() => {
    fetchAlarms()
    fetchIntegrations()
  }, [fetchAlarms, fetchIntegrations])

  // Auto refresh active alarms every 30 seconds
  useEffect(() => {
    if (activeTab !== 'active') return
    const interval = setInterval(fetchAlarms, 30000)
    return () => clearInterval(interval)
  }, [fetchAlarms, activeTab])

  const handleClearAlarm = async (id: number) => {
    if (!confirm('Clear this alarm?')) return
    try {
      const res = await fetch(`/api/alarms/${id}/clear`, { method: 'POST' })
      if (res.ok) {
        fetchAlarms()
      }
    } catch (err) {
      console.error('Clear alarm error:', err)
    }
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}h ${m}m`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
  }

  const totalPages = Math.ceil(pagination.total / pagination.limit)
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Bell className="w-6 h-6 text-amber-400" />
              Alarms
            </h1>
            <p className="text-sm text-gray-400 mt-1">Monitor threshold violations and alarm history</p>
          </div>
          <button
            onClick={fetchAlarms}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-gray-300 hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Integration Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {integrations.map((integration) => {
            const isActive = integration.status === 'active'
            const iconMap: Record<string, any> = {
              telegram: Send,
              whatsapp: MessageCircle,
              ticketing: Ticket,
            }
            const Icon = iconMap[integration.platform] || Link2
            const statusColor = isActive
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-gray-500/10 border-gray-500/30 text-gray-400'
            const statusIcon = isActive ? Link2 : Unlink
            const StatusIcon = statusIcon

            return (
              <button
                key={integration.platform}
                onClick={() => { setSelectedIntegration(integration); setIsModalOpen(true) }}
                className={`rounded-xl border p-4 flex items-center gap-4 text-left hover:opacity-80 transition-opacity ${statusColor}`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isActive ? 'bg-emerald-500/20' : 'bg-gray-500/20'}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{integration.name}</p>
                  <p className="text-xs opacity-70">
                    {isActive ? 'Connected' : 'Disconnected'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 opacity-50" />
                  <div className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-500/20 text-gray-400'}`}>
                    {integration.status}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <IntegrationConfigModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          integration={selectedIntegration}
          onSave={handleSaveIntegration}
        />

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-700">
          <button
            onClick={() => { setActiveTab('active'); setPagination(p => ({ ...p, offset: 0 })) }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'active'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Active Alarms
            </span>
          </button>
          <button
            onClick={() => { setActiveTab('history'); setPagination(p => ({ ...p, offset: 0 })) }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              History
            </span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search device name or serial..."
              value={deviceSearch}
              onChange={(e) => setDeviceSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={alarmTypeFilter}
              onChange={(e) => setAlarmTypeFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-gray-200 focus:outline-none focus:border-amber-500/50"
            >
              <option value="">All Types</option>
              <option value="upload">Upload</option>
              <option value="download">Download</option>
              <option value="latency">Latency</option>
            </select>
          </div>
          {activeTab === 'history' && (
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-gray-200 focus:outline-none focus:border-amber-500/50"
            >
              <option value="1h">Last 1 Hour</option>
              <option value="6h">Last 6 Hours</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          )}
        </div>

        {/* Table */}
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-800 text-gray-400 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3">Device</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Value / Threshold</th>
                  <th className="px-4 py-3">Triggered</th>
                  {activeTab === 'active' ? (
                    <>
                      <th className="px-4 py-3">Duration</th>
                      <th className="px-4 py-3">Actions</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-3">Cleared</th>
                      <th className="px-4 py-3">Duration</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {alarms.length === 0 && (
                  <tr>
                    <td colSpan={activeTab === 'active' ? 6 : 6} className="px-4 py-8 text-center text-gray-500">
                      {loading ? 'Loading...' : `No ${activeTab} alarms found`}
                    </td>
                  </tr>
                )}
                {alarms.map((alarm) => (
                  <tr
                    key={alarm.id}
                    className={activeTab === 'active' ? 'bg-amber-500/5 hover:bg-amber-500/10' : 'hover:bg-slate-700/30'}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-200">{alarm.device_name}</div>
                      <div className="text-xs text-gray-500">{alarm.serial_number}</div>
                      <div className="text-xs text-gray-600">{alarm.cpe_type}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${alarmTypeColors[alarm.alarm_type] || 'bg-gray-500/20 text-gray-300 border-gray-500/30'}`}>
                        {alarmTypeLabels[alarm.alarm_type] || alarm.alarm_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className={`font-semibold ${activeTab === 'active' ? 'text-amber-400' : 'text-gray-300'}`}>
                        {alarm.metric_value} {alarm.alarm_type === 'latency' ? 'ms' : 'Mbps'}
                      </div>
                      <div className="text-xs text-gray-500">
                        threshold: {alarm.threshold_value} {alarm.alarm_type === 'latency' ? 'ms' : 'Mbps'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(alarm.triggered_at).toLocaleString('id-ID')}
                    </td>
                    {activeTab === 'active' ? (
                      <>
                        <td className="px-4 py-3 text-gray-400">
                          {formatDuration(alarm.duration_seconds)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleClearAlarm(alarm.id)}
                            className="px-3 py-1 rounded-md bg-emerald-500/20 text-emerald-300 text-xs hover:bg-emerald-500/30 transition-colors border border-emerald-500/30"
                          >
                            Clear
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-gray-400">
                          {alarm.cleared_at ? new Date(alarm.cleared_at).toLocaleString('id-ID') : '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-400">
                          {formatDuration(alarm.duration_seconds)}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.total > pagination.limit && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
              <div className="text-xs text-gray-500">
                Showing {pagination.offset + 1}-{Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPagination(p => ({ ...p, offset: Math.max(0, p.offset - p.limit) }))}
                  disabled={currentPage <= 1}
                  className="p-1 rounded-md bg-slate-800 border border-slate-700 text-gray-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-400">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setPagination(p => ({ ...p, offset: p.offset + p.limit }))}
                  disabled={currentPage >= totalPages}
                  className="p-1 rounded-md bg-slate-800 border border-slate-700 text-gray-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
