'use client'

import { useState, useEffect } from 'react'
import { BarChart3, Download, FileText, MapPin, Building2, Box, Cpu, Activity, AlertTriangle, Server } from 'lucide-react'
import GlobalFilter from '@/components/GlobalFilter'

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

  const fetchReport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v as string) })

      let endpoint = '/api/reports/v2'
      const p = new URLSearchParams()
      p.set('type', activeReport)
      Object.entries(filters).forEach(([k, v]) => { if (v) p.set(k, v as string) })
      endpoint += '?' + p.toString()

      const res = await fetch(`${endpoint}?${params}`)
      const data = await res.json()
      setReportData(data.data || data || [])
    } catch (e) {
      console.error(e)
      setReportData([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchReport() }, [activeReport, filters])

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 p-6">
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
          <GlobalFilter onFilterChange={setFilters} />
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {loading ? (
                  <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-gray-400">Loading...</td></tr>
                ) : reportData.length === 0 ? (
                  <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-gray-400">No data available</td></tr>
                ) : reportData.map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-700/30 transition-colors">
                    {columns.map(col => (
                      <td key={col} className="px-4 py-3 text-sm text-white whitespace-nowrap">
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
    </div>
  )
}