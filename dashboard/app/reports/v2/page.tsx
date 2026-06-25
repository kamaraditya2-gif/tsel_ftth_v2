'use client'

import { useState, useEffect, useMemo } from 'react'
import { BarChart3, Download, FileText, MapPin, Building2, Box, Cpu, Activity, AlertTriangle, Server, X, Eye, ChevronDown, ChevronUp } from 'lucide-react'
import LocationFilter from '@/components/LocationFilter'

const REPORT_TYPES = [
  { id: 'alarm-area', label: 'Alarm per Area', icon: MapPin },
  { id: 'alarm-regional', label: 'Alarm per Regional', icon: Building2 },
  { id: 'alarm-nop', label: 'Alarm per NOP', icon: Server },
  { id: 'alarm-brand', label: 'Alarm per Brand', icon: Box },
  { id: 'alarm-ont-type', label: 'Alarm per ONT Type', icon: Cpu },
  { id: 'availability', label: 'Availability', icon: Activity },
  { id: 'rca-summary', label: 'RCA Summary', icon: AlertTriangle },
  { id: 'performance', label: 'Performance Summary', icon: BarChart3 },
]

export default function ReportsV2Page() {
  const [activeReport, setActiveReport] = useState('alarm-area')
  const [reportData, setReportData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({})
  const [locFilters, setLocFilters] = useState({ areaId: null as number | null, regionalId: null as number | null, nopId: null as number | null })
  const [allDevices, setAllDevices] = useState<any[]>([])
  const [detailRow, setDetailRow] = useState<any>(null)

  useEffect(() => {
    fetch('/api/devices').then(r => r.json()).then(d => setAllDevices(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  const fetchReport = async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      p.set('type', activeReport)
      if (locFilters.areaId) p.set('area_id', locFilters.areaId.toString())
      if (locFilters.regionalId) p.set('regional_id', locFilters.regionalId.toString())
      if (locFilters.nopId) p.set('nop_id', locFilters.nopId.toString())
      Object.entries(filters).forEach(([k, v]) => { if (v) p.set(k, v as string) })

      const res = await fetch(`/api/reports/v2?${p}`)
      const data = await res.json()
      setReportData(data.data || data || [])
    } catch (e) {
      console.error(e)
      setReportData([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchReport() }, [activeReport, filters, locFilters])

  const exportCSV = () => {
    if (reportData.length === 0) return
    const headers = Object.keys(reportData[0])
    const rows = reportData.map(r => headers.map(h => r[h]).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeReport}-report.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const columns = reportData.length > 0 ? Object.keys(reportData[0]) : []

  const detailDevices = useMemo(() => {
    if (!detailRow) return []
    switch (activeReport) {
      case 'alarm-area':
        return allDevices.filter(d => d.area_name === detailRow.area)
      case 'alarm-regional':
        return allDevices.filter(d => d.region_name === detailRow.regional)
      case 'alarm-nop':
        return allDevices.filter(d => d.nop_name === detailRow.nop)
      case 'alarm-brand':
        return allDevices.filter(d => (d.manufacturer || '').toLowerCase() === (detailRow.brand || '').toLowerCase())
      case 'alarm-ont-type':
        return allDevices.filter(d => d.cpe_type === detailRow.ont_type)
      case 'availability':
        return allDevices.filter(d =>
          d.area_name === detailRow.area &&
          d.region_name === detailRow.regional &&
          d.nop_name === detailRow.nop
        )
      case 'performance':
        return allDevices
      default:
        return []
    }
  }, [detailRow, allDevices, activeReport])

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Reports</h1>
              <p className="text-xs text-gray-400">Analytics grouped by area, regional, brand, and more</p>
            </div>
          </div>
          <button onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 text-sm font-medium">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>

        {/* Filter */}
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-md p-4">
          <LocationFilter onFilterChange={(a,r,n) => {
            setLocFilters({ areaId: a, regionalId: r, nopId: n })
          }} />
        </div>

        {/* Report Type Tabs */}
        <div className="flex flex-wrap gap-2">
          {REPORT_TYPES.map(rt => {
            const Icon = rt.icon
            return (
              <button key={rt.id} onClick={() => setActiveReport(rt.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeReport === rt.id
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-lg shadow-emerald-500/10'
                    : 'bg-slate-800/50 text-gray-400 border border-slate-700/50 hover:bg-slate-700/50 hover:text-gray-200'
                }`}>
                <Icon className="w-4 h-4" /> {rt.label}
              </button>
            )
          })}
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/80">
                  {columns.map(col => (
                    <th key={col} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      {col.replace(/_/g, ' ')}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {loading ? (
                  <tr><td colSpan={columns.length + 1} className="px-4 py-10 text-center text-gray-400">Loading...</td></tr>
                ) : reportData.length === 0 ? (
                  <tr><td colSpan={columns.length + 1} className="px-4 py-10 text-center text-gray-400">No data available</td></tr>
                ) : reportData.map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-700/30 transition-colors">
                    {columns.map(col => (
                      <td key={col} className="px-4 py-3 text-sm text-white whitespace-nowrap cursor-pointer" onClick={() => setDetailRow(row)}>
                        {col.includes('count') || col.includes('total') ? (
                          <span className="font-bold">{row[col]}</span>
                        ) : col.includes('pct') || col.includes('rate') ? (
                          <span className={`font-mono ${row[col] > 90 ? 'text-green-400' : row[col] > 70 ? 'text-amber-400' : 'text-red-400'}`}>
                            {row[col]}%
                          </span>
                        ) : col.includes('latency') || col.includes('ping') ? (
                          <span className="font-mono text-blue-300">{row[col]} ms</span>
                        ) : (
                          <span>{row[col]}</span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <button onClick={() => setDetailRow(detailRow === row ? null : row)}
                        className="p-1 rounded-lg hover:bg-slate-600 text-gray-400">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {reportData.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-700 text-xs text-gray-500">
              {reportData.length} rows
            </div>
          )}
        </div>
      </div>

      {/* Device Detail Slide-in Panel */}
      {detailRow && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setDetailRow(null)}>
          <div className="w-full max-w-2xl bg-slate-900 h-full overflow-y-auto shadow-2xl border-l border-slate-700" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-slate-900 z-10 flex items-center justify-between p-6 border-b border-slate-700">
              <div>
                <h2 className="text-lg font-bold text-white">Device Details</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {activeReport === 'alarm-area' && `Area: ${detailRow.area}`}
                  {activeReport === 'alarm-regional' && `Regional: ${detailRow.regional}`}
                  {activeReport === 'alarm-nop' && `NOP: ${detailRow.nop}`}
                  {activeReport === 'alarm-brand' && `Brand: ${detailRow.brand}`}
                  {activeReport === 'alarm-ont-type' && `ONT Type: ${detailRow.ont_type}`}
                  {activeReport === 'availability' && `${detailRow.area} / ${detailRow.regional} / ${detailRow.nop}`}
                  {activeReport === 'performance' && 'All Devices'}
                  &nbsp;&middot; {detailDevices.length} devices
                </p>
              </div>
              <button onClick={() => setDetailRow(null)} className="p-2 rounded-lg hover:bg-slate-700 text-gray-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-3">
              {detailDevices.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No devices found for this group.</p>
              ) : (
                detailDevices.map(d => (
                  <div key={d.id} className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 hover:border-slate-600 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold text-white">{d.device_name || d.serial_number}</p>
                        <p className="text-xs text-gray-400 font-mono">{d.serial_number}{d.indihome_id ? ` · ${d.indihome_id}` : ''}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${d.status === 'online' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                        {d.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-gray-500">Brand</span>
                        <p className="text-gray-300">{d.manufacturer || '-'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Type</span>
                        <p className="text-gray-300">{d.cpe_type || '-'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Speed</span>
                        <p className="text-gray-300">{d.speed_name || '-'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">NOP</span>
                        <p className="text-gray-300">{d.nop_name || '-'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Regional</span>
                        <p className="text-gray-300">{d.region_name || '-'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Area</span>
                        <p className="text-gray-300">{d.area_name || '-'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Avg Ping (24h)</span>
                        <p className="font-mono text-blue-300">{Number(d.avg_ping).toFixed(2)} ms</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Alias</span>
                        <p className="text-gray-300">{d.alias_device || '-'}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
