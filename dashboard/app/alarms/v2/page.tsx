'use client'

import { useState, useEffect } from 'react'
import { Bell, AlertTriangle, AlertCircle, CheckCircle, XCircle, Clock, Eye, ChevronDown, ChevronUp, Activity, Zap, MessageSquare, FileText, Play } from 'lucide-react'
import GlobalFilter from '@/components/GlobalFilter'

interface Alarm {
  alarm_id: number
  alarm_type: string
  metric_value: number
  threshold_value: number
  severity: string
  message: string
  triggered_at: string
  last_checked_at: string
  device_id: number
  device_name: string
  serial_number: string
  brand: string
  ont_type: string
  ip_address: string
  device_status: string
  nop_name: string
  regional_name: string
  area_name: string
}

export default function AlarmsV2Page() {
  const [alarms, setAlarms] = useState<Alarm[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [filters, setFilters] = useState<any>({})
  const limit = 20

  const fetchAlarms = async (f: any = filters, p: number = page) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      Object.entries(f).forEach(([k, v]) => { if (v) params.set(k, v as string) })
      params.set('page', p.toString())
      params.set('limit', limit.toString())

      const res = await fetch(`/api/alarms/v2?${params}`)
      const data = await res.json()
      setAlarms(data.alarms || [])
      setTotal(data.total || 0)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAlarms() }, [])

  const handleFilterChange = (newFilters: any) => {
    setFilters(newFilters)
    setPage(1)
    fetchAlarms(newFilters, 1)
  }

  const totalPages = Math.ceil(total / limit)
  const severityColor = (s: string) => s === 'critical' ? 'text-red-400 bg-red-500/10' : 'text-amber-400 bg-amber-500/10'
  const statusColor = (s: string) => s === 'online' ? 'text-green-400' : s === 'offline' ? 'text-red-400' : 'text-amber-400'

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/20">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Alarm Management</h1>
            <p className="text-xs text-gray-400">{total} total alarms</p>
          </div>
        </div>

        {/* Global Filter */}
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-md p-4">
          <GlobalFilter onFilterChange={handleFilterChange} />
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/80">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Alarm Info</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Device</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Brand / Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Value</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Severity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Last Check</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {loading ? (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">Loading alarms...</td></tr>
                ) : alarms.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">No alarms found</td></tr>
                ) : alarms.map((alarm) => (
                  <>
                    <tr key={alarm.alarm_id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-white capitalize">{alarm.alarm_type.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-gray-400 mt-0.5">ID: {alarm.alarm_id}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-white">{alarm.device_name}</p>
                        <p className="text-xs text-gray-400">{alarm.serial_number}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-white">{alarm.brand || '-'}</p>
                        <p className="text-xs text-gray-400">{alarm.ont_type || '-'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-white">{alarm.nop_name || '-'}</p>
                        <p className="text-xs text-gray-400">{alarm.regional_name || ''}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-mono text-white">{alarm.metric_value}</p>
                        <p className="text-xs text-gray-400">threshold: {alarm.threshold_value}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${severityColor(alarm.severity)}`}>
                          {alarm.severity === 'critical' ? <AlertCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                          {alarm.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-300">
                          {alarm.last_checked_at ? new Date(alarm.last_checked_at).toLocaleString('id-ID') : '-'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button className="p-1.5 rounded-lg hover:bg-blue-500/20 text-blue-400" title="On Demand Test"><Play className="w-4 h-4" /></button>
                          <button className="p-1.5 rounded-lg hover:bg-green-500/20 text-green-400" title="Recheck"><Activity className="w-4 h-4" /></button>
                          <button className="p-1.5 rounded-lg hover:bg-purple-500/20 text-purple-400" title="Follow Up"><MessageSquare className="w-4 h-4" /></button>
                          <button className="p-1.5 rounded-lg hover:bg-amber-500/20 text-amber-400" title="Add Comment"><FileText className="w-4 h-4" /></button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setExpandedId(expandedId === alarm.alarm_id ? null : alarm.alarm_id)}
                          className="p-1 rounded-lg hover:bg-slate-600 text-gray-400"
                        >
                          {expandedId === alarm.alarm_id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                    {expandedId === alarm.alarm_id && (
                      <tr key={`${alarm.alarm_id}-detail`}>
                        <td colSpan={9} className="px-6 py-4 bg-slate-800/30">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-xs text-gray-400 mb-1">Message</p>
                              <p className="text-sm text-white">{alarm.message}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400 mb-1">Area</p>
                              <p className="text-sm text-white">{alarm.area_name || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400 mb-1">IP Address</p>
                              <p className="text-sm text-white">{alarm.ip_address || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400 mb-1">Device Status</p>
                              <p className={`text-sm ${statusColor(alarm.device_status)}`}>{alarm.device_status}</p>
                            </div>
                            <div className="md:col-span-4 flex gap-2 mt-2">
                              <button className="px-3 py-1.5 text-xs rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30">On Demand Test</button>
                              <button className="px-3 py-1.5 text-xs rounded-lg bg-green-500/20 text-green-300 hover:bg-green-500/30">Recheck</button>
                              <button className="px-3 py-1.5 text-xs rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30">Create RCA</button>
                              <button className="px-3 py-1.5 text-xs rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30">Close Alarm</button>
                              <button className="px-3 py-1.5 text-xs rounded-lg bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30">Acknowledge</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
              <p className="text-sm text-gray-400">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => { setPage(page - 1); fetchAlarms(filters, page - 1) }}
                  className="px-3 py-1.5 text-xs rounded-lg bg-slate-700 text-white disabled:opacity-40 hover:bg-slate-600">Prev</button>
                <button disabled={page >= totalPages} onClick={() => { setPage(page + 1); fetchAlarms(filters, page + 1) }}
                  className="px-3 py-1.5 text-xs rounded-lg bg-slate-700 text-white disabled:opacity-40 hover:bg-slate-600">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}