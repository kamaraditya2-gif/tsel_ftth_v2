'use client'

import { useState, useEffect } from 'react'
import { Download, Clock, Activity, MapPin } from 'lucide-react'

export default function DownloadDataPage() {
  const [type, setType] = useState('ping')
  const [days, setDays] = useState(1)
  const [search, setSearch] = useState('')
  const [selectedRegion, setSelectedRegion] = useState('')
  const [downstreamServers, setDownstreamServers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/downstream-servers').then(r => r.json()).then(d => setDownstreamServers(d.servers || [])).catch(() => {})
  }, [])

  const download = async () => {
    setLoading(true)
    setError('')
    setTotal(null)
    try {
    const params = new URLSearchParams({ type, days: days.toString() })
    if (selectedRegion) params.set('region_id', selectedRegion)
    if (search.trim()) params.set('search', search.trim())
      const res = await fetch(`/api/admin/download-data?${params}`)
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setTotal(data.total)

      const headers = type === 'ping'
        ? ['ID', 'Serial', 'Device', 'Brand', 'ONT Type', 'Ping IGW (ms)', 'Ping EBR (ms)', 'Packet Loss IGW (%)', 'Packet Loss EBR (%)', 'Success', 'Executed At']
        : ['ID', 'Serial', 'Device', 'Brand', 'ONT Type', 'Total Hops', 'Total RTT (ms)', 'Route', 'Success', 'Executed At']

      const parseHops = (raw: any) => {
        if (!raw) return ''
        try {
          const hops = typeof raw === 'string' ? JSON.parse(raw) : raw
          return (Array.isArray(hops) ? hops : []).map((h: any, i: number) =>
            `Hop${i + 1}:${h.ip || h.address || '-'}(${h.rtt || h.rtt_ms || '-'})`
          ).join(' | ')
        } catch { return '' }
      }
      const mapRow = (r: any) => type === 'ping'
        ? [r.id, r.serial_number, r.device_name, r.manufacturer, r.cpe_type, r.ping_igw, r.ping_ebr, r.packet_loss_igw, r.packet_loss_ebr, r.success ? 'Yes' : 'No', r.executed_at]
        : [r.id, r.serial_number, r.device_name, r.manufacturer, r.cpe_type, r.total_hops, r.total_rtt_ms, parseHops(r.traceroute_raw), r.success ? 'Yes' : 'No', r.executed_at]

      const q = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
      let csv = headers.map(h => q(h)).join(';') + '\n'
      data.rows.forEach((r: any) => {
        csv += mapRow(r).map(v => q(v)).join(';') + '\n'
      })

      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}_data_${days}d_${new Date().toISOString().substring(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen p-6 bg-transparent">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Download className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Download Raw Data</h1>
            <p className="text-xs text-gray-400">Download ping / traceroute test results by region</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-md p-6 space-y-4">
          {/* Data Type */}
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">Data Type</label>
            <div className="flex gap-2">
              {['ping', 'traceroute'].map(t => (
                <button key={t} onClick={() => setType(t)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    type === t
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'bg-slate-700/50 text-gray-400 border border-slate-600/50 hover:bg-slate-700'
                  }`}>
                  {t === 'ping' ? <Activity className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                  {t === 'ping' ? 'Ping Results' : 'Traceroute Results'}
                </button>
              ))}
            </div>
          </div>

          {/* Days */}
          <div>
            <label className="text-xs text-gray-400 block mb-1.5 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Time Range
            </label>
            <div className="flex gap-2 flex-wrap">
              {[1, 2, 3, 5, 7].map(d => (
                <button key={d} onClick={() => setDays(d)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    days === d
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'bg-slate-700/50 text-gray-400 border border-slate-600/50 hover:bg-slate-700'
                  }`}>
                  {d} {d === 1 ? 'Day' : 'Days'}
                </button>
              ))}
            </div>
          </div>

          {/* Region Filter */}
          <div>
            <label className="text-xs text-gray-400 block mb-1.5 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Filter by Region
            </label>
            <select value={selectedRegion} onChange={e => setSelectedRegion(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm">
              <option value="">All Regions</option>
              {downstreamServers.map(s => (
                <option key={s.id} value={s.id}>{s.name} — {s.province}</option>
              ))}
            </select>
          </div>

          {/* Download */}
          <button onClick={download} disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-600 text-white font-semibold transition-colors">
            <Download className="w-4 h-4" />
            {loading ? 'Downloading...' : `Download ${type.toUpperCase()} Data (Last ${days} Day${days > 1 ? 's' : ''})`}
          </button>

          {total !== null && (
            <p className="text-xs text-emerald-400 text-center">{total} rows downloaded</p>
          )}
          {error && (
            <p className="text-xs text-red-400 text-center">{error}</p>
          )}
        </div>
      </div>
    </div>
  )
}
