'use client'

import { useEffect, useState } from 'react'
import {
  Activity, ArrowRight,
  TrendingUp, TrendingDown, Wifi, WifiOff,
  Download, Upload, Zap, AlertTriangle
} from 'lucide-react'
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts'

interface Averages {
  avg_ping_igw: number
  avg_ping_ebr: number
  avg_packet_loss: number
  avg_download_speed: number
  avg_upload_speed: number
  total_devices: number
  online_count: number
  offline_count: number
  success_rate: number
  total_tests: number
}

interface TrendData {
  hour: string
  avg_ping_igw: number
  avg_ping_ebr: number
  avg_packet_loss: number
  avg_download_speed: number
  avg_upload_speed: number
}

interface NetworkOverviewHeaderProps {
  areaId?: number | null
  regionalId?: number | null
  nopId?: number | null
}

export default function NetworkOverviewHeader({ areaId, regionalId, nopId }: NetworkOverviewHeaderProps) {
  const [averages, setAverages] = useState<Averages | null>(null)
  const [trends, setTrends] = useState<TrendData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams()
    if (areaId) params.set('area_id', areaId.toString())
    if (regionalId) params.set('regional_id', regionalId.toString())
    if (nopId) params.set('nop_id', nopId.toString())
    const qs = params.toString()

    Promise.all([
      fetch(`/api/devices/averages${qs ? `?${qs}` : ''}`).then(r => r.json()),
      fetch(`/api/devices/aggregated-trends${qs ? `?${qs}` : ''}`).then(r => r.json())
    ]).then(([avgData, trendData]) => {
      setAverages(avgData)
      setTrends(Array.isArray(trendData) ? trendData : [])
    }).catch(err => {
      console.error('Failed to fetch network overview:', err)
    }).finally(() => {
      setLoading(false)
    })
  }, [areaId, regionalId, nopId])

  if (loading) {
    return (
      <div className="bg-[#0a0b16] rounded-2xl border border-white/10 p-8 mb-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 bg-white/5 rounded" />
          <div className="h-32 bg-white/5 rounded-xl" />
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-20 bg-white/5 rounded-xl" />)}
          </div>
        </div>
      </div>
    )
  }

  if (!averages) return null

  const isOnline = averages.online_count > 0
  const avgPingIgw = averages.avg_ping_igw
  const avgPingEbr = averages.avg_ping_ebr

  const ontToOlt = isOnline ? 1.2 : null
  const oltToEbr = avgPingEbr > 0 ? Math.max(0.5, avgPingEbr - 1.2) : (isOnline ? 8.5 : null)
  let ebrToIgw = null
  if (avgPingIgw > 0 && avgPingEbr > 0) {
    ebrToIgw = Math.max(0.5, avgPingIgw - avgPingEbr)
  } else if (avgPingIgw > 0) {
    ebrToIgw = Math.max(0.5, avgPingIgw - 10)
  } else if (isOnline) {
    ebrToIgw = 12.3
  }

  const getLatencyColor = (ms: any) => {
    const n = num(ms)
    if (n < 15) return 'text-emerald-400'
    if (n < 50) return 'text-amber-400'
    return 'text-rose-400'
  }

  const getStrokeColor = (ms: any) => {
    const n = Number(ms)
    if (!n) return '#4b5563'
    if (n < 15) return '#10b981'
    if (n < 50) return '#f59e0b'
    return '#ef4444'
  }

  const num = (v: any) => { const n = Number(v); return isNaN(n) ? 0 : n }
  const formatMs = (v: any) => { const n = num(v); return n ? `${n.toFixed(1)} ms` : '-' }
  const formatMbps = (v: any) => { const n = num(v); return n ? `${n.toFixed(1)} Mbps` : '-' }
  const formatPct = (v: any) => `${num(v).toFixed(1)}%`

  return (
    <div className="mb-3">

      {/* ===== TOPOLOGY SECTION ===== */}
      <details className="group">
        <summary className="flex items-center gap-2 cursor-pointer text-xs text-gray-400 hover:text-gray-200 mb-1 select-none">
          <Activity className="w-3 h-3 text-cyan-400" />
          <span className="font-semibold uppercase tracking-wider">Network Topology</span>
          <span className="text-[9px] text-gray-500 font-normal normal-case">(24h)</span>
          <svg className="w-3 h-3 ml-auto transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </summary>
        <div className="relative bg-[#0a0b16] rounded-xl border border-white/10 p-3 shadow overflow-hidden mt-1">
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-[10px]">
              <span className="flex items-center gap-1 text-emerald-400">
                <Wifi className="w-3 h-3" />{averages.online_count}
              </span>
              {averages.offline_count > 0 && (
                <span className="flex items-center gap-1 text-rose-400">
                  <WifiOff className="w-3 h-3" />{averages.offline_count}
                </span>
              )}
              <span className="text-gray-500">|</span>
              <span className="text-gray-400">{averages.total_devices} devices</span>
            </div>
          </div>

          {/* Network Chain Diagram */}
          <div className="flex flex-row items-center justify-between gap-2 relative py-1">
            {/* Node 1: NETWORK (All Devices) */}
            <div className="flex flex-col items-center z-10 w-16 group">
              <div className="relative transition-transform duration-300 group-hover:scale-105">
                <svg className="w-12 h-12 drop-shadow-[0_0_8px_rgba(34,211,238,0.2)]" viewBox="0 0 100 100" fill="none">
                  <rect x="15" y="45" width="70" height="35" rx="6" fill="#1e1e2f" stroke="#22d3ee" strokeWidth="2" />
                  <circle cx="35" cy="62" r="2" fill="#10b981" className="animate-pulse" />
                  <circle cx="45" cy="62" r="2" fill="#10b981" />
                  <circle cx="55" cy="62" r="2" fill="#22d3ee" className="animate-pulse" />
                  <circle cx="65" cy="62" r="2" fill="#22d3ee" />
                </svg>
              </div>
              <span className="text-[7px] font-bold text-cyan-400 tracking-wider leading-tight text-center">NETWORK</span>
              {averages.total_devices} devices
            </div>

            <div className="flex items-center gap-1 text-[9px] font-mono text-gray-400 flex-wrap justify-center">
              <span className="text-[10px] text-cyan-400 font-bold">ONT/ONU</span>
              <ArrowRight className="w-3 h-3" />
              <span className={ontToOlt ? getLatencyColor(ontToOlt) : 'text-gray-500'}>{isOnline ? `${num(ontToOlt).toFixed(1)}ms` : 'off'}</span>
              <ArrowRight className="w-3 h-3" />
              <span className="text-[10px] text-blue-400 font-bold">OLT</span>
              <ArrowRight className="w-3 h-3" />
              <span className={oltToEbr ? getLatencyColor(oltToEbr) : 'text-gray-500'}>{isOnline ? `${num(oltToEbr).toFixed(1)}ms` : 'off'}</span>
              <ArrowRight className="w-3 h-3" />
              <span className="text-[10px] text-purple-400 font-bold">EBR</span>
              <ArrowRight className="w-3 h-3" />
              <span className={ebrToIgw ? getLatencyColor(ebrToIgw) : 'text-gray-500'}>{isOnline ? `${num(ebrToIgw).toFixed(1)}ms` : 'off'}</span>
              <ArrowRight className="w-3 h-3" />
              <span className="text-[10px] text-emerald-400 font-bold">IGW</span>
            </div>

            <div className="flex items-center gap-3 text-[9px] text-gray-500 mt-1">
              <span>avg EBR <span className={num(avgPingEbr) > 0 ? getLatencyColor(avgPingEbr) : 'text-gray-500'}>{num(avgPingEbr) > 0 ? `${num(avgPingEbr).toFixed(1)}ms` : '-'}</span></span>
              <span>avg IGW <span className={num(avgPingIgw) > 0 ? getLatencyColor(avgPingIgw) : 'text-gray-500'}>{num(avgPingIgw) > 0 ? `${num(avgPingIgw).toFixed(1)}ms` : '-'}</span></span>
            </div>
          </div>
        </div>
      </div>
      </details>

      {/* ===== KPI CARDS ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          {
            label: 'Avg Latency (IGW)',
            value: formatMs(avgPingIgw),
            icon: Zap,
            textColor: 'text-cyan-400'
          },
          {
            label: 'Avg Download',
            value: formatMbps(averages.avg_download_speed),
            icon: Download,
            textColor: 'text-emerald-400'
          },
          {
            label: 'Avg Upload',
            value: formatMbps(averages.avg_upload_speed),
            icon: Upload,
            textColor: 'text-purple-400'
          },
          {
            label: 'Success Rate',
            value: formatPct(averages.success_rate),
            icon: TrendingUp,
            textColor: averages.success_rate > 90 ? 'text-emerald-400' : 'text-rose-400'
          }
        ].map((card, i) => (
          <div key={i} className="bg-[#0f0f1a]/80 backdrop-blur-md rounded-lg border border-white/5 p-2 hover:border-white/10 transition-all">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[9px] text-gray-400 uppercase tracking-wider">{card.label}</span>
              <card.icon className={`w-3 h-3 ${card.textColor}`} />
            </div>
            <p className={`text-sm font-bold font-mono ${card.textColor}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Additional mini KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
        {[
          { label: 'Avg Packet Loss', value: formatPct(averages.avg_packet_loss), color: averages.avg_packet_loss > 2 ? 'text-rose-400' : 'text-emerald-400', icon: AlertTriangle },
          { label: 'Online Devices', value: `${averages.online_count}/${averages.total_devices}`, color: 'text-emerald-400', icon: Wifi },
          { label: 'Avg Latency (EBR)', value: formatMs(avgPingEbr), color: 'text-purple-400', icon: Activity },
          { label: 'Total Tests (24h)', value: averages.total_tests.toLocaleString(), color: 'text-blue-400', icon: TrendingDown }
        ].map((item, i) => (
          <div key={i} className="bg-[#0f0f1a]/80 backdrop-blur-md rounded-lg border border-white/5 p-2 flex items-center gap-2 hover:border-white/10 transition-all">
            <div className={`w-6 h-6 rounded-md bg-white/5 flex items-center justify-center ${item.color}`}>
              <item.icon className="w-3 h-3" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] text-gray-500 uppercase tracking-wider truncate">{item.label}</p>
              <p className={`text-[11px] font-bold font-mono ${item.color} truncate`}>{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ===== TREND CHARTS (collapsed) ===== */}
      {trends.length > 0 && (
        <details className="group mt-2">
          <summary className="flex items-center gap-2 cursor-pointer text-[10px] text-gray-500 hover:text-gray-300 select-none">
            <Activity className="w-3 h-3 text-cyan-400" />
            <span className="font-semibold uppercase tracking-wider">Trends</span>
            <svg className="w-3 h-3 ml-auto transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </summary>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
            <div className="bg-[#0a0b16] rounded-lg border border-white/10 p-3">
              <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Activity className="w-3 h-3 text-cyan-400" />
                Avg Latency Trend (24h)
              </h4>
              <ResponsiveContainer width="100%" height={100}>
                <AreaChart data={trends}>
                  <defs>
                    <linearGradient id="igwGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="ebrGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                  <XAxis dataKey="hour" stroke="#4b5563" fontSize={8} tickLine={false} />
                  <YAxis stroke="#4b5563" fontSize={8} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#1a1b2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} itemStyle={{ color: '#e5e7eb', fontSize: '10px' }} labelStyle={{ color: '#9ca3af', fontSize: '9px' }} />
                  <Area type="monotone" dataKey="avg_ping_igw" stroke="#22d3ee" strokeWidth={1.5} fill="url(#igwGrad)" name="IGW" dot={false} />
                  <Area type="monotone" dataKey="avg_ping_ebr" stroke="#a855f7" strokeWidth={1.5} fill="url(#ebrGrad)" name="EBR" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-[#0a0b16] rounded-lg border border-white/10 p-3">
              <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Download className="w-3 h-3 text-emerald-400" />
                Avg Speed Trend (24h)
              </h4>
              <ResponsiveContainer width="100%" height={100}>
                <AreaChart data={trends}>
                  <defs>
                    <linearGradient id="dlGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="ulGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                  <XAxis dataKey="hour" stroke="#4b5563" fontSize={8} tickLine={false} />
                  <YAxis stroke="#4b5563" fontSize={8} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#1a1b2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} itemStyle={{ color: '#e5e7eb', fontSize: '10px' }} labelStyle={{ color: '#9ca3af', fontSize: '9px' }} />
                  <Area type="monotone" dataKey="avg_download_speed" stroke="#10b981" strokeWidth={1.5} fill="url(#dlGrad)" name="Download" dot={false} />
                  <Area type="monotone" dataKey="avg_upload_speed" stroke="#f59e0b" strokeWidth={1.5} fill="url(#ulGrad)" name="Upload" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </details>
      )}
    </div>
  )
}
