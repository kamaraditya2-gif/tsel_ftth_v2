'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell
} from 'recharts'
import { FileText, Download, FileSpreadsheet, Calendar, Filter, BarChart3 } from 'lucide-react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import html2canvas from 'html2canvas'

interface ReportData {
  group_id: string | null
  group_name: string
  group_code?: string
  group_limit?: number
  total_devices: number
  avg_download_speed: number
  avg_upload_speed: number
  avg_downstream_latency: number
  avg_upstream_latency: number
  avg_packet_loss_downstream: number
  avg_packet_loss_upstream: number
  total_download_tests: number
  total_upload_tests: number
  total_ping_tests: number
  total_tests: number
}

interface DeviceDetail {
  device_id: number
  device_name: string
  serial_number: string
  cpe_type: string
  manufacturer: string
  model: string
  regional_name: string
  speed_name: string
  avg_download_speed: number
  avg_upload_speed: number
  avg_downstream_latency: number
  avg_upstream_latency: number
  avg_packet_loss_downstream: number
  avg_packet_loss_upstream: number
  total_tests: number
}

interface ReportSummary {
  total_devices: number
  total_download_tests: number
  total_upload_tests: number
  total_ping_tests: number
}

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e']

export default function ReportsPage() {
  const [reportType, setReportType] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedCpeType, setSelectedCpeType] = useState('')
  const [cpeTypes, setCpeTypes] = useState<string[]>([])
  const [data, setData] = useState<ReportData[]>([])
  const [details, setDetails] = useState<DeviceDetail[]>([])
  const [summary, setSummary] = useState<ReportSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [showTable, setShowTable] = useState(true)
  const chartRef = useRef<HTMLDivElement>(null)

  const fetchReport = async () => {
    setLoading(true)
    setMessage('')
    try {
      const params = new URLSearchParams()
      params.append('type', reportType)
      if (dateFrom) params.append('date_from', dateFrom)
      if (dateTo) params.append('date_to', dateTo)
      if (reportType === 'cpe_type' && selectedCpeType) params.append('id', selectedCpeType)

      const res = await fetch(`/api/reports?${params.toString()}`)
      const json = await res.json()

      if (res.ok) {
        setData(json.data || [])
        setDetails(json.details || [])
        setSummary(json.summary || null)
        if (json.data.length === 0) {
          setMessage('No data found for selected filters')
        }
      } else {
        setMessage(json.error || 'Failed to fetch report')
      }
    } catch (err: any) {
      setMessage(err.message || 'Error fetching report')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
    fetchCpeTypes()
  }, [])

  const fetchCpeTypes = async () => {
    try {
      const res = await fetch('/api/devices?cpe_types_only=true')
      const json = await res.json()
      if (res.ok && json.cpe_types) {
        setCpeTypes(json.cpe_types)
      }
    } catch (err) {
      console.error('Failed to fetch CPE types:', err)
    }
  }

  const chartData = useMemo(() => {
    return data.map(d => ({
      name: d.group_name || 'Unknown',
      'Download (Mbps)': Number(d.avg_download_speed) || 0,
      'Upload (Mbps)': Number(d.avg_upload_speed) || 0,
      'Downstream Latency (ms)': Number(d.avg_downstream_latency) || 0,
      'Upstream Latency (ms)': Number(d.avg_upstream_latency) || 0,
      'Packet Loss Down (%)': Number(d.avg_packet_loss_downstream) || 0,
      'Packet Loss Up (%)': Number(d.avg_packet_loss_upstream) || 0,
      Devices: Number(d.total_devices) || 0,
      Tests: Number(d.total_tests) || 0,
    }))
  }, [data])

  const exportExcel = () => {
    if (data.length === 0) return

    const summarySheet = [
      ['Report Type', reportType.toUpperCase()],
      ['Date From', dateFrom || 'All time'],
      ['Date To', dateTo || 'All time'],
      ['Total Devices', summary?.total_devices || 0],
      ['Total Download Tests', summary?.total_download_tests || 0],
      ['Total Upload Tests', summary?.total_upload_tests || 0],
      ['Total Ping Tests', summary?.total_ping_tests || 0],
      [],
    ]

    const headers = [
      'Group Name', 'Devices', 'Avg Download (Mbps)', 'Avg Upload (Mbps)',
      'Downstream Latency (ms)', 'Upstream Latency (ms)',
      'Packet Loss Down (%)', 'Packet Loss Up (%)',
      'Download Tests', 'Upload Tests', 'Ping Tests', 'Total Tests'
    ]

    const rows = data.map(d => [
      d.group_name,
      d.total_devices,
      d.avg_download_speed,
      d.avg_upload_speed,
      d.avg_downstream_latency,
      d.avg_upstream_latency,
      d.avg_packet_loss_downstream,
      d.avg_packet_loss_upstream,
      d.total_download_tests,
      d.total_upload_tests,
      d.total_ping_tests,
      d.total_tests,
    ])

    const detailHeaders = [
      'Device Name', 'Serial Number', 'Type', 'Manufacturer', 'Model',
      'Regional', 'Speed', 'Avg Download (Mbps)', 'Avg Upload (Mbps)',
      'Downstream Latency (ms)', 'Upstream Latency (ms)',
      'Packet Loss Down (%)', 'Packet Loss Up (%)', 'Total Tests'
    ]

    const detailRows = details.map(d => [
      d.device_name,
      d.serial_number,
      d.cpe_type,
      d.manufacturer,
      d.model,
      d.regional_name,
      d.speed_name,
      d.avg_download_speed,
      d.avg_upload_speed,
      d.avg_downstream_latency,
      d.avg_upstream_latency,
      d.avg_packet_loss_downstream,
      d.avg_packet_loss_upstream,
      d.total_tests,
    ])

    const wb = XLSX.utils.book_new()
    const ws1 = XLSX.utils.aoa_to_sheet([...summarySheet, headers, ...rows])
    XLSX.utils.book_append_sheet(wb, ws1, 'Summary')

    const ws2 = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows])
    XLSX.utils.book_append_sheet(wb, ws2, 'Device Details')

    XLSX.writeFile(wb, `MojoCentral_Report_${reportType}_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const exportPDF = async () => {
    if (data.length === 0) return
    const doc = new jsPDF('landscape')

    doc.setFontSize(18)
    doc.text('Mojo-Central Report', 14, 20)
    doc.setFontSize(11)
    doc.text(`Type: ${reportType.toUpperCase()} | Date: ${dateFrom || 'All'} to ${dateTo || 'All'}`, 14, 28)

    if (chartRef.current) {
      try {
        const canvas = await html2canvas(chartRef.current, { scale: 2 })
        const imgData = canvas.toDataURL('image/png')
        const imgWidth = 270
        const imgHeight = (canvas.height * imgWidth) / canvas.width
        doc.addImage(imgData, 'PNG', 14, 35, imgWidth, Math.min(imgHeight, 80))
      } catch (e) {
        console.error('Chart capture failed', e)
      }
    }

    autoTable(doc, {
      startY: chartRef.current ? 120 : 35,
      head: [['Group', 'Devices', 'Avg DL', 'Avg UL', 'DS Lat', 'US Lat', 'PL Down', 'PL Up', 'Tests']],
      body: data.map(d => [
        d.group_name,
        d.total_devices,
        d.avg_download_speed + ' Mbps',
        d.avg_upload_speed + ' Mbps',
        d.avg_downstream_latency + ' ms',
        d.avg_upstream_latency + ' ms',
        d.avg_packet_loss_downstream + '%',
        d.avg_packet_loss_upstream + '%',
        d.total_tests,
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [239, 68, 68] },
    })

    doc.save(`MojoCentral_Report_${reportType}_${new Date().toISOString().split('T')[0]}.pdf`)
  }

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-purple-400" />
              Reports
            </h1>
            <p className="text-gray-400 mt-1">Generate performance reports with charts and export options</p>
          </div>
          <div className="flex gap-2 mt-4 md:mt-0">
            <button onClick={exportExcel} disabled={data.length === 0} className="flex items-center gap-2 px-4 py-2 bg-green-600/80 backdrop-blur-md text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition border border-green-500/30 shadow-lg shadow-green-500/10">
              <FileSpreadsheet className="w-4 h-4" /> Excel
            </button>
            <button onClick={exportPDF} disabled={data.length === 0} className="flex items-center gap-2 px-4 py-2 bg-red-600/80 backdrop-blur-md text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition border border-red-500/30 shadow-lg shadow-red-500/10">
              <FileText className="w-4 h-4" /> PDF
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-md p-4 mb-6 shadow-lg shadow-purple-500/10">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-purple-300 uppercase tracking-wider mb-1">Report Type</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="px-3 py-2 border border-purple-500/30 rounded-lg bg-slate-800/80 text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
              >
                <option value="all">All Devices</option>
                <option value="regional">By Regional</option>
                <option value="speed">By Speed Group</option>
                <option value="cpe_type">By CPE Type</option>
              </select>
            </div>
            {reportType === 'cpe_type' && (
              <div>
                <label className="block text-xs font-medium text-purple-300 uppercase tracking-wider mb-1">CPE Type</label>
                <select
                  value={selectedCpeType}
                  onChange={(e) => setSelectedCpeType(e.target.value)}
                  className="px-3 py-2 border border-purple-500/30 rounded-lg bg-slate-800/80 text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                >
                  <option value="">All CPE Types</option>
                  {cpeTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-purple-300 uppercase tracking-wider mb-1">Date From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2 border border-purple-500/30 rounded-lg bg-slate-800/80 text-white focus:ring-2 focus:ring-purple-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-purple-300 uppercase tracking-wider mb-1">Date To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2 border border-purple-500/30 rounded-lg bg-slate-800/80 text-white focus:ring-2 focus:ring-purple-500 text-sm"
              />
            </div>
            <button
              onClick={fetchReport}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600/80 backdrop-blur-md text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 transition border border-purple-500/30 shadow-lg shadow-purple-500/20"
            >
              <Filter className="w-4 h-4" />
              {loading ? 'Loading...' : 'Generate'}
            </button>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl text-yellow-200 backdrop-blur-md">
            {message}
          </div>
        )}

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-md p-5 shadow-lg shadow-purple-500/10 hover:shadow-xl hover:shadow-purple-500/20 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              <p className="text-xs font-medium text-purple-300 uppercase tracking-wider">Total Devices</p>
              <p className="text-3xl font-bold text-white mt-1">{summary.total_devices}</p>
              <div className="mt-2 h-1 w-full bg-purple-500/20 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: '100%' }} />
              </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-md p-5 shadow-lg shadow-blue-500/10 hover:shadow-xl hover:shadow-blue-500/20 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              <p className="text-xs font-medium text-blue-300 uppercase tracking-wider">Download Tests</p>
              <p className="text-3xl font-bold text-white mt-1">{summary.total_download_tests}</p>
              <div className="mt-2 h-1 w-full bg-blue-500/20 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: '100%' }} />
              </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-green-500/20 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-md p-5 shadow-lg shadow-green-500/10 hover:shadow-xl hover:shadow-green-500/20 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              <p className="text-xs font-medium text-green-300 uppercase tracking-wider">Upload Tests</p>
              <p className="text-3xl font-bold text-white mt-1">{summary.total_upload_tests}</p>
              <div className="mt-2 h-1 w-full bg-green-500/20 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: '100%' }} />
              </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-pink-500/20 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-md p-5 shadow-lg shadow-pink-500/10 hover:shadow-xl hover:shadow-pink-500/20 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-20 h-20 bg-pink-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              <p className="text-xs font-medium text-pink-300 uppercase tracking-wider">Ping Tests</p>
              <p className="text-3xl font-bold text-white mt-1">{summary.total_ping_tests}</p>
              <div className="mt-2 h-1 w-full bg-pink-500/20 rounded-full overflow-hidden">
                <div className="h-full bg-pink-500 rounded-full" style={{ width: '100%' }} />
              </div>
            </div>
          </div>
        )}

        {/* Charts */}
        {data.length > 0 && (
          <div ref={chartRef} className="space-y-6 mb-6">
            {/* Speed Overview */}
            <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-md p-5 shadow-lg shadow-cyan-500/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-cyan-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Speed Overview</h2>
                    <p className="text-xs text-cyan-300/70">Download & Upload throughput per group</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="gradDL" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.9}/>
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.4}/>
                      </linearGradient>
                      <linearGradient id="gradUL" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.9}/>
                        <stop offset="100%" stopColor="#059669" stopOpacity={0.4}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: 'rgba(148,163,184,0.2)' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: 'rgba(148,163,184,0.2)' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(6,182,212,0.3)', borderRadius: '12px', backdropFilter: 'blur(12px)' }}
                      itemStyle={{ color: '#e2e8f0', fontSize: '12px' }}
                      labelStyle={{ color: '#67e8f9', fontWeight: 600, marginBottom: '4px' }}
                    />
                    <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="Download (Mbps)" fill="url(#gradDL)" radius={[6,6,0,0]} barSize={28} animationDuration={1200} />
                    <Bar dataKey="Upload (Mbps)" fill="url(#gradUL)" radius={[6,6,0,0]} barSize={28} animationDuration={1200} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Latency Overview */}
            <div className="rounded-2xl border border-orange-500/20 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-md p-5 shadow-lg shadow-orange-500/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-orange-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Latency Overview</h2>
                    <p className="text-xs text-orange-300/70">Downstream vs Upstream RTT per group</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="gradDS" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.9}/>
                        <stop offset="100%" stopColor="#d97706" stopOpacity={0.4}/>
                      </linearGradient>
                      <linearGradient id="gradUS" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity={0.9}/>
                        <stop offset="100%" stopColor="#dc2626" stopOpacity={0.4}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: 'rgba(148,163,184,0.2)' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: 'rgba(148,163,184,0.2)' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '12px', backdropFilter: 'blur(12px)' }}
                      itemStyle={{ color: '#e2e8f0', fontSize: '12px' }}
                      labelStyle={{ color: '#fdba74', fontWeight: 600, marginBottom: '4px' }}
                    />
                    <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="Downstream Latency (ms)" fill="url(#gradDS)" radius={[6,6,0,0]} barSize={28} animationDuration={1200} />
                    <Bar dataKey="Upstream Latency (ms)" fill="url(#gradUS)" radius={[6,6,0,0]} barSize={28} animationDuration={1200} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Packet Loss Overview */}
            <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-md p-5 shadow-lg shadow-purple-500/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Packet Loss Overview</h2>
                    <p className="text-xs text-purple-300/70">Downstream vs Upstream packet loss per group</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="gradPLD" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a855f7" stopOpacity={0.9}/>
                        <stop offset="100%" stopColor="#7e22ce" stopOpacity={0.4}/>
                      </linearGradient>
                      <linearGradient id="gradPLU" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ec4899" stopOpacity={0.9}/>
                        <stop offset="100%" stopColor="#be185d" stopOpacity={0.4}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: 'rgba(148,163,184,0.2)' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: 'rgba(148,163,184,0.2)' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '12px', backdropFilter: 'blur(12px)' }}
                      itemStyle={{ color: '#e2e8f0', fontSize: '12px' }}
                      labelStyle={{ color: '#d8b4fe', fontWeight: 600, marginBottom: '4px' }}
                    />
                    <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="Packet Loss Down (%)" fill="url(#gradPLD)" radius={[6,6,0,0]} barSize={28} animationDuration={1200} />
                    <Bar dataKey="Packet Loss Up (%)" fill="url(#gradPLU)" radius={[6,6,0,0]} barSize={28} animationDuration={1200} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Device & Test Count */}
            <div className="rounded-2xl border border-pink-500/20 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-md p-5 shadow-lg shadow-pink-500/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-pink-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg shadow-pink-500/20">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Device & Test Count</h2>
                    <p className="text-xs text-pink-300/70">Device count vs total tests executed per group</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="gradDev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.9}/>
                        <stop offset="100%" stopColor="#0891b2" stopOpacity={0.4}/>
                      </linearGradient>
                      <linearGradient id="gradTest" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f97316" stopOpacity={0.9}/>
                        <stop offset="100%" stopColor="#ea580c" stopOpacity={0.4}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: 'rgba(148,163,184,0.2)' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: 'rgba(148,163,184,0.2)' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(236,72,153,0.3)', borderRadius: '12px', backdropFilter: 'blur(12px)' }}
                      itemStyle={{ color: '#e2e8f0', fontSize: '12px' }}
                      labelStyle={{ color: '#f9a8d4', fontWeight: 600, marginBottom: '4px' }}
                    />
                    <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="Devices" fill="url(#gradDev)" radius={[6,6,0,0]} barSize={28} animationDuration={1200} />
                    <Bar dataKey="Tests" fill="url(#gradTest)" radius={[6,6,0,0]} barSize={28} animationDuration={1200} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Toggle Table */}
        {data.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setShowTable(!showTable)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 backdrop-blur-md text-purple-300 rounded-lg hover:bg-slate-700/80 transition border border-purple-500/20"
            >
              <BarChart3 className="w-4 h-4" />
              {showTable ? 'Hide Table' : 'Show Table'}
            </button>
          </div>
        )}

        {/* Summary Table */}
        {showTable && data.length > 0 && (
          <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-md overflow-hidden mb-6 shadow-lg shadow-purple-500/10">
            <div className="px-6 py-4 border-b border-purple-500/20">
              <h2 className="text-lg font-semibold text-white">Summary Report</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-purple-500/10 text-purple-300 uppercase">
                  <tr>
                    <th className="px-4 py-3 font-medium text-xs">Group</th>
                    <th className="px-4 py-3 font-medium text-xs">Devices</th>
                    <th className="px-4 py-3 font-medium text-xs">Avg DL</th>
                    <th className="px-4 py-3 font-medium text-xs">Avg UL</th>
                    <th className="px-4 py-3 font-medium text-xs">DS Lat</th>
                    <th className="px-4 py-3 font-medium text-xs">US Lat</th>
                    <th className="px-4 py-3 font-medium text-xs">PL Down</th>
                    <th className="px-4 py-3 font-medium text-xs">PL Up</th>
                    <th className="px-4 py-3 font-medium text-xs">Tests</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-500/10">
                  {data.map((row, idx) => (
                    <tr key={idx} className="hover:bg-purple-500/5 transition-colors">
                      <td className="px-4 py-3 font-medium text-white whitespace-nowrap">{row.group_name}</td>
                      <td className="px-4 py-3 text-gray-300">{row.total_devices}</td>
                      <td className="px-4 py-3 text-blue-400 font-medium whitespace-nowrap">{row.avg_download_speed} Mbps</td>
                      <td className="px-4 py-3 text-green-400 font-medium whitespace-nowrap">{row.avg_upload_speed} Mbps</td>
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{row.avg_downstream_latency} ms</td>
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{row.avg_upstream_latency} ms</td>
                      <td className="px-4 py-3 text-gray-300">{row.avg_packet_loss_downstream}%</td>
                      <td className="px-4 py-3 text-gray-300">{row.avg_packet_loss_upstream}%</td>
                      <td className="px-4 py-3 text-gray-300">{row.total_tests}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Device Details Table */}
        {showTable && details.length > 0 && (
          <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-md overflow-hidden shadow-lg shadow-purple-500/10">
            <div className="px-6 py-4 border-b border-purple-500/20">
              <h2 className="text-lg font-semibold text-white">Device Details</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-purple-500/10 text-purple-300 uppercase">
                  <tr>
                    <th className="px-4 py-3 font-medium text-xs">Device</th>
                    <th className="px-4 py-3 font-medium text-xs">Serial</th>
                    <th className="px-4 py-3 font-medium text-xs">Type</th>
                    <th className="px-4 py-3 font-medium text-xs">Regional</th>
                    <th className="px-4 py-3 font-medium text-xs">Speed</th>
                    <th className="px-4 py-3 font-medium text-xs">Avg DL</th>
                    <th className="px-4 py-3 font-medium text-xs">Avg UL</th>
                    <th className="px-4 py-3 font-medium text-xs">DS Lat</th>
                    <th className="px-4 py-3 font-medium text-xs">US Lat</th>
                    <th className="px-4 py-3 font-medium text-xs">PL Down</th>
                    <th className="px-4 py-3 font-medium text-xs">PL Up</th>
                    <th className="px-4 py-3 font-medium text-xs">Tests</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-500/10">
                  {details.map((d, idx) => (
                    <tr key={idx} className="hover:bg-purple-500/5 transition-colors">
                      <td className="px-4 py-3 font-medium text-white whitespace-nowrap">{d.device_name}</td>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{d.serial_number}</td>
                      <td className="px-4 py-3 text-gray-300">{d.cpe_type}</td>
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{d.regional_name}</td>
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{d.speed_name}</td>
                      <td className="px-4 py-3 text-blue-400 whitespace-nowrap">{d.avg_download_speed}</td>
                      <td className="px-4 py-3 text-green-400 whitespace-nowrap">{d.avg_upload_speed}</td>
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{d.avg_downstream_latency}</td>
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{d.avg_upstream_latency}</td>
                      <td className="px-4 py-3 text-gray-300">{d.avg_packet_loss_downstream}%</td>
                      <td className="px-4 py-3 text-gray-300">{d.avg_packet_loss_upstream}%</td>
                      <td className="px-4 py-3 text-gray-300">{d.total_tests}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
