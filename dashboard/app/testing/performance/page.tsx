'use client'

import { useState, useEffect, useRef } from 'react'
import { Activity, RefreshCw, Network, Search } from 'lucide-react'
import NetworkDiagram from '@/components/NetworkDiagram'
import LocationFilter from '@/components/LocationFilter'

function countHops(raw: any): number {
  if (!raw) return 0
  if (typeof raw === 'object') {
    if (Array.isArray(raw)) return raw.length
    return Object.keys(raw).length
  }
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p.length : Object.keys(p).length }
  catch { return 0 }
}

function parseTraceroute(raw: any): Array<{hop: number; ip: string; rtt: string}> {
  if (!raw) return []
  if (typeof raw === 'object') {
    if (Array.isArray(raw)) return raw.map((h: any, i: number) => ({
      hop: h.hop || i + 1, ip: h.ip || h.address || '-', rtt: h.rtt || h.rtt_ms || '-'
    }))
    return Object.entries(raw).map(([k, v]: [string, any]) => ({
      hop: parseInt(k) || 1, ip: v.ip || v.address || '-', rtt: v.rtt || v.rtt_ms || '-'
    }))
  }
  try {
    const p = JSON.parse(raw)
    return Array.isArray(p) ? p.map((h: any, i: number) => ({
      hop: h.hop || i + 1, ip: h.ip || h.address || '-', rtt: h.rtt || h.rtt_ms || '-'
    })) : []
  } catch { return [] }
}

export default function PerformanceTestPage() {
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({})
  const [locFilters, setLocFilters] = useState({ areaId: null as number | null, regionalId: null as number | null, nopId: null as number | null, areaIds: '', regionalIds: '', nopIds: '' })
  const filtersRef = useRef(filters)
  const locRef = useRef(locFilters)
  filtersRef.current = filters
  locRef.current = locFilters
  const [traceDevice, setTraceDevice] = useState<any>(null)
  const [thresholds, setThresholds] = useState<any[]>([])
  const intervalRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    fetch('/api/admin/threshold?status=active').then(r => r.json()).then(d => setThresholds(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  const getThreshold = (alarmName: string, speedName?: string) => {
    const t = thresholds.filter(th => th.alarm_name === alarmName)
    if (t.length === 0) return null
    if (t.length === 1) return t[0]
    const match = speedName ? t.find(th => th.profile?.toLowerCase() === speedName.toLowerCase()) : null
    return match || t[0]
  }

  const thresholdColor = (value: number | null, alarmName: string, speedName?: string): string => {
    if (value === null || value === undefined) return 'text-gray-500'
    const th = getThreshold(alarmName, speedName)
    if (!th) return 'text-gray-500'
    if (th.threshold_type === 'UPPER') {
      if (value >= th.critical_value) return 'text-red-400'
      if (value >= th.warning_value) return 'text-amber-400'
    } else {
      if (value <= th.critical_value) return 'text-red-400'
      if (value <= th.warning_value) return 'text-amber-400'
    }
    return 'text-emerald-400'
  }

  const thresholdText = (value: number | null, alarmName: string, speedName?: string): string => {
    const th = getThreshold(alarmName, speedName)
    if (!th) return ''
    if (th.threshold_type === 'UPPER') {
      if (value !== null && value >= th.critical_value) return `>${th.critical_value}${th.unit}`
      if (value !== null && value >= th.warning_value) return `>${th.warning_value}${th.unit}`
    } else {
      if (value !== null && value <= th.critical_value) return `<${th.critical_value}${th.unit}`
      if (value !== null && value <= th.warning_value) return `<${th.warning_value}${th.unit}`
    }
    return ''
  }

  const fetchResults = async (f: any = filters, loc: any = locFilters) => {
    try {
      const params = new URLSearchParams({ limit: '50' })
      Object.entries(f).forEach(([k, v]) => { if (v) params.set(k, v as string) })
      if ((loc as any).areaIds) params.set('area_ids', (loc as any).areaIds)
      else if (loc.areaId) params.set('area_id', loc.areaId.toString())
      if ((loc as any).regionalIds) params.set('regional_ids', (loc as any).regionalIds)
      else if (loc.regionalId) params.set('regional_id', loc.regionalId.toString())
      if ((loc as any).nopIds) params.set('nop_ids', (loc as any).nopIds)
      else if (loc.nopId) params.set('nop_id', loc.nopId.toString())
      const res = await fetch(`/api/performance?${params}`)
      const data = await res.json()
      if (data.results) setResults(data.results)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchResults()
    intervalRef.current = setInterval(() => {
      fetchResults(filtersRef.current, locRef.current)
    }, 5000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  const handleFilterChange = (newFilters: any) => {
    setFilters(newFilters)
    setLoading(true)
    fetchResults(newFilters)
  }

  const formatTime = (t: string) => {
    if (!t) return '-'
    return new Date(t).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="min-h-screen p-6 bg-transparent">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Performance Test</h1>
              <p className="text-xs text-gray-400">Auto-refresh setiap 5 detik</p>
            </div>
          </div>
          <button onClick={() => fetchResults()} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700 text-white text-sm hover:bg-slate-600">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <LocationFilter onFilterChange={(f) => {
            const nl = { areaId: f.areaIds[0] ?? null, regionalId: f.regionalIds[0] ?? null, nopId: f.nopIds[0] ?? null, areaIds: f.areaIds.join(','), regionalIds: f.regionalIds.join(','), nopIds: f.nopIds.join(',') }
            setLocFilters(nl)
            fetchResults(filters, nl)
          }} />
          <input
            type="text"
            placeholder="Search device..."
            value={(filters as any).search || ''}
            onChange={(e) => {
              const nf = { ...filters, search: e.target.value }
              setFilters(nf)
              fetchResults(nf, locFilters)
            }}
            className="px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-xs focus:outline-none focus:ring-2 focus:ring-red-500 w-40"
          />
        </div>

        {/* Network Diagram */}
        {results.length > 0 && (
          <NetworkDiagram
            upstream={{
              avgDownload: Number(results.reduce((s:number,r:any)=>s+Number(r.download||0),0)/Math.max(results.filter((r:any)=>r.download).length,1)).toFixed(2),
              avgUpload: Number(results.reduce((s:number,r:any)=>s+Number(r.upload||0),0)/Math.max(results.filter((r:any)=>r.upload).length,1)).toFixed(2),
              avgLatency: Number(results.reduce((s:number,r:any)=>s+Number(r.latency||0),0)/Math.max(results.filter((r:any)=>r.latency).length,1)).toFixed(2),
              avgEbrLatency: Number(results.reduce((s:number,r:any)=>s+Number(r.latency_ebr||0),0)/Math.max(results.filter((r:any)=>r.latency_ebr).length,1)).toFixed(2),
            }}
            downstream={{
              avgLatency: Number(results.filter((r:any)=>r.latency).length > 0 ? results.reduce((s:number,r:any)=>s+Number(r.latency||0),0)/results.filter((r:any)=>r.latency).length : 0).toFixed(2),
              avgPacketLoss: Number(results.filter((r:any)=>r.packet_loss).length > 0 ? results.reduce((s:number,r:any)=>s+Number(r.packet_loss||0),0)/results.filter((r:any)=>r.packet_loss).length : 0).toFixed(2),
            }}
          />
        )}

        {/* Table */}
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/80">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Device</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Brand</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Latency</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Download</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Upload</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Packet Loss</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Traceroute</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Last Check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {loading ? (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">Loading...</td></tr>
                ) : results.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">No results found</td></tr>
                ) : results.map((r: any, i: number) => (
                  <tr key={r.id || i} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm text-white">{r.device_name || r.serial_number || '-'}</p>
                      <p className="text-xs text-gray-400">{r.serial_number || ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-white">{r.brand || '-'}</p>
                      <p className="text-xs text-gray-400">{r.ont_type || ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      {r.latency != null ? (
                        <div>
                          <span className={`text-sm font-mono ${thresholdColor(r.latency, 'Latency')}`}>{r.latency} ms</span>
                          {thresholdText(r.latency, 'Latency') && <span className="text-[9px] text-gray-500 ml-1">{thresholdText(r.latency, 'Latency')}</span>}
                        </div>
                      ) : <span className="text-xs text-red-400">Failed</span>}
                      {r.latency_ebr != null && <div className="text-[10px] text-gray-500 mt-0.5">EBR: {r.latency_ebr} ms</div>}
                    </td>
                    <td className="px-4 py-3">
                      {r.download != null ? (
                        <div>
                          <span className={`text-sm font-mono ${thresholdColor(r.download, 'Download_Speed', r.speed_name)}`}>{r.download} Mbps</span>
                          {thresholdText(r.download, 'Download_Speed', r.speed_name) && <span className="text-[9px] text-gray-500 ml-1">{thresholdText(r.download, 'Download_Speed', r.speed_name)}</span>}
                        </div>
                      ) : <span className="text-xs text-red-400">Failed</span>}
                    </td>
                    <td className="px-4 py-3">
                      {r.upload != null ? (
                        <div>
                          <span className={`text-sm font-mono ${thresholdColor(r.upload, 'Upload_Speed', r.speed_name)}`}>{r.upload} Mbps</span>
                          {thresholdText(r.upload, 'Upload_Speed', r.speed_name) && <span className="text-[9px] text-gray-500 ml-1">{thresholdText(r.upload, 'Upload_Speed', r.speed_name)}</span>}
                        </div>
                      ) : <span className="text-xs text-red-400">Failed</span>}
                    </td>
                    <td className="px-4 py-3">
                      {r.packet_loss != null ? (
                        <div>
                          <span className={`text-sm font-mono ${thresholdColor(r.packet_loss, 'Packet_Loss')}`}>{r.packet_loss}%</span>
                          {thresholdText(r.packet_loss, 'Packet_Loss') && <span className="text-[9px] text-gray-500 ml-1">{thresholdText(r.packet_loss, 'Packet_Loss')}</span>}
                        </div>
                      ) : <span className="text-xs text-red-400">Failed</span>}
                    </td>
                    <td className="px-4 py-3">
                      {r.traceroute_raw ? (
                        <button onClick={() => setTraceDevice(r)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-500/20 text-purple-300 text-xs hover:bg-purple-500/30">
                          <Network className="w-3 h-3" /> {r.total_hops || countHops(r.traceroute_raw)} hops
                        </button>
                      ) : <span className="text-xs text-red-400">Failed</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        r.status === 'completed' ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'
                      }`}>
                        {r.status === 'completed' ? 'Success' : 'No Data'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {formatTime(r.last_test_time || r.ping_time || r.download_time || r.upload_time)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-slate-700 text-xs text-gray-500">
            {results.length} devices
          </div>
        </div>
      </div>

      {/* Traceroute Modal */}
      {traceDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setTraceDevice(null)}>
          <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Traceroute — {traceDevice.device_name || traceDevice.serial_number}</h3>
                <p className="text-xs text-gray-400">{traceDevice.serial_number}</p>
              </div>
              <button onClick={() => setTraceDevice(null)} className="p-1 rounded-lg hover:bg-slate-700 text-gray-400">&times;</button>
            </div>

            <div className="space-y-0">
              {(() => {
                const hops = parseTraceroute(traceDevice.traceroute_raw)
                if (hops.length === 0) return <p className="text-sm text-gray-400">No traceroute data</p>
                return hops.map((hop, idx) => (
                  <div key={idx}>
                    <div className="flex items-center gap-3 py-2">
                      <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-xs font-bold text-purple-300 shrink-0">
                        {hop.hop}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{hop.ip}</p>
                      </div>
                      <div className="text-xs font-mono text-gray-400 shrink-0">{hop.rtt}</div>
                    </div>
                    {idx < hops.length - 1 && (
                      <div className="ml-4 pl-4 border-l border-slate-700 h-4" />
                    )}
                  </div>
                ))
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}