'use client'

import { useEffect, useState } from 'react'
import {
  Activity, Server, Cpu, Database, Network,
  TrendingUp, TrendingDown, Wifi, WifiOff,
  Download, Upload, Zap, AlertTriangle
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
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

export default function NetworkOverviewHeader() {
  const [averages, setAverages] = useState<Averages | null>(null)
  const [trends, setTrends] = useState<TrendData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/devices/averages').then(r => r.json()),
      fetch('/api/devices/aggregated-trends').then(r => r.json())
    ]).then(([avgData, trendData]) => {
      setAverages(avgData)
      setTrends(Array.isArray(trendData) ? trendData : [])
    }).catch(err => {
      console.error('Failed to fetch network overview:', err)
    }).finally(() => {
      setLoading(false)
    })
  }, [])

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

  const getLatencyColor = (ms: number) => {
    if (ms < 15) return 'text-emerald-400'
    if (ms < 50) return 'text-amber-400'
    return 'text-rose-400'
  }

  const getStrokeColor = (ms: number | null) => {
    if (ms === null || ms === undefined) return '#4b5563'
    if (ms < 15) return '#10b981'
    if (ms < 50) return '#f59e0b'
    return '#ef4444'
  }

  const formatMs = (v: number) => v ? `${v.toFixed(1)} ms` : '-'
  const formatMbps = (v: number) => v ? `${v.toFixed(1)} Mbps` : '-'
  const formatPct = (v: number) => `${v.toFixed(1)}%`

  return (
    <div className="mb-6 space-y-5">

      {/* ===== TOPOLOGY SECTION ===== */}
      <div className="relative bg-[#0a0b16] rounded-2xl border border-white/10 p-6 shadow-xl overflow-hidden">
        {/* Background glow orbs */}
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none animate-pulse" style={{animationDuration: '4s'}} />
        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl pointer-events-none animate-pulse" style={{animationDuration: '6s'}} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-500/3 rounded-full blur-3xl pointer-events-none" />

        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(rgba(0,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,255,0.3) 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }}
        />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
              Network-Wide Topology
              <span className="text-[10px] text-gray-500 font-normal normal-case">(24h averages)</span>
            </h3>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-emerald-400">
                <Wifi className="w-3.5 h-3.5" />{averages.online_count} Online
              </span>
              {averages.offline_count > 0 && (
                <span className="flex items-center gap-1 text-rose-400">
                  <WifiOff className="w-3.5 h-3.5" />{averages.offline_count} Offline
                </span>
              )}
              <span className="text-gray-500">|</span>
              <span className="text-gray-400">{averages.total_devices} Devices</span>
            </div>
          </div>

          {/* Network Chain Diagram */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative px-4 py-6">
            {/* Animated SVG connection lines */}
            <div className="absolute inset-0 hidden md:block pointer-events-none">
              <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <path d="M 110,60 L 210,60" stroke={getStrokeColor(ontToOlt)} strokeWidth="3" strokeDasharray="8 6" className="animate-dash" style={{animationDuration: '3s', animation: 'dash 3s linear infinite'}} />
                <path d="M 310,60 L 410,60" stroke={getStrokeColor(oltToEbr)} strokeWidth="3" strokeDasharray="8 6" className="animate-dash" style={{animationDuration: '2s', animation: 'dash 2s linear infinite'}} />
                <path d="M 510,60 L 610,60" stroke={getStrokeColor(ebrToIgw)} strokeWidth="3" strokeDasharray="8 6" className="animate-dash" style={{animationDuration: '1.2s', animation: 'dash 1.2s linear infinite'}} />
              </svg>
            </div>

            {/* Node 1: NETWORK (All Devices) */}
            <div className="flex flex-col items-center z-10 w-32 group">
              <div className="relative mb-2 transition-transform duration-300 group-hover:scale-105">
                <svg className="w-24 h-24 drop-shadow-[0_0_12px_rgba(34,211,238,0.3)]" viewBox="0 0 100 100" fill="none">
                  <rect x="15" y="45" width="70" height="35" rx="6" fill="#1e1e2f" stroke="#22d3ee" strokeWidth="2.5" />
                  <rect x="25" y="40" width="15" height="5" fill="#22d3ee" rx="1" />
                  <rect x="60" y="40" width="15" height="5" fill="#22d3ee" rx="1" />
                  <line x1="25" y1="40" x2="15" y2="15" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" />
                  <line x1="75" y1="40" x2="85" y2="15" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="35" cy="62" r="2.5" fill="#10b981" className="animate-pulse" />
                  <circle cx="45" cy="62" r="2.5" fill="#10b981" />
                  <circle cx="55" cy="62" r="2.5" fill="#22d3ee" className="animate-pulse" />
                  <circle cx="65" cy="62" r="2.5" fill="#22d3ee" />
                  <text x="50" y="93" fill="#9ca3af" fontSize="7" textAnchor="middle" fontWeight="bold">ALL DEVICES</text>
                </svg>
                <div className="absolute -top-1 -right-1">
                  <span className="flex h-3.5 w-3.5 relative">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'} opacity-75`} />
                    <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
                  </span>
                </div>
              </div>
              <span className="text-xs font-bold text-cyan-400 tracking-wider">NETWORK AVERAGE</span>
              <span className="text-[10px] text-gray-400 font-mono mt-0.5">{averages.total_devices} devices</span>
            </div>

            {/* Segment 1 */}
            <div className="flex flex-col items-center bg-[#151726]/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/5 shadow-md -my-2 md:-mt-8 z-20">
              <span className="text-[8px] text-gray-500 uppercase tracking-widest">Fiber Link</span>
              <span className={`text-[11px] font-bold ${ontToOlt ? 'text-emerald-400' : 'text-gray-500'}`}>
                {isOnline ? `${ontToOlt?.toFixed(1)} ms` : 'Offline'}
              </span>
            </div>

            {/* Node 2: OLT */}
            <div className="flex flex-col items-center z-10 w-32 group">
              <div className="w-18 h-18 rounded-2xl bg-gradient-to-br from-blue-900/40 to-slate-900/40 border border-blue-500/30 flex items-center justify-center mb-2 shadow-[0_0_15px_rgba(59,130,246,0.1)] transition-transform duration-300 group-hover:scale-105 group-hover:border-blue-400">
                <Server className={`w-8 h-8 ${isOnline ? 'text-blue-400' : 'text-gray-600'}`} />
              </div>
              <span className="text-xs font-bold text-blue-400 tracking-wider">OLT (CO)</span>
              <span className="text-[10px] text-gray-400 font-mono mt-0.5">Optical Line Terminal</span>
            </div>

            {/* Segment 2 */}
            <div className="flex flex-col items-center bg-[#151726]/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/5 shadow-md -my-2 md:-mt-8 z-20">
              <span className="text-[8px] text-gray-500 uppercase tracking-widest">GPON Backhaul</span>
              <span className={`text-[11px] font-bold ${oltToEbr ? getLatencyColor(oltToEbr) : 'text-gray-500'}`}>
                {isOnline ? `${oltToEbr?.toFixed(1)} ms` : 'Offline'}
              </span>
            </div>

            {/* Node 3: EBR */}
            <div className="flex flex-col items-center z-10 w-32 group">
              <div className="w-18 h-18 rounded-2xl bg-gradient-to-br from-purple-900/40 to-slate-900/40 border border-purple-500/30 flex items-center justify-center mb-2 shadow-[0_0_15px_rgba(168,85,247,0.1)] transition-transform duration-300 group-hover:scale-105 group-hover:border-purple-400">
                <Cpu className={`w-8 h-8 ${isOnline ? 'text-purple-400' : 'text-gray-600'}`} />
              </div>
              <span className="text-xs font-bold text-purple-400 tracking-wider">EBR (EDGE)</span>
              <span className="text-[10px] text-gray-400 font-mono mt-0.5">Edge Broadband Router</span>
            </div>

            {/* Segment 3 */}
            <div className="flex flex-col items-center bg-[#151726]/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/5 shadow-md -my-2 md:-mt-8 z-20">
              <span className="text-[8px] text-gray-500 uppercase tracking-widest">Metro Transit</span>
              <span className={`text-[11px] font-bold ${ebrToIgw ? getLatencyColor(ebrToIgw) : 'text-gray-500'}`}>
                {isOnline ? `${ebrToIgw?.toFixed(1)} ms` : 'Offline'}
              </span>
            </div>

            {/* Node 4: IGW */}
            <div className="flex flex-col items-center z-10 w-32 group">
              <div className="w-18 h-18 rounded-2xl bg-gradient-to-br from-emerald-900/40 to-slate-900/40 border border-emerald-500/30 flex items-center justify-center mb-2 shadow-[0_0_15px_rgba(16,185,129,0.1)] transition-transform duration-300 group-hover:scale-105 group-hover:border-emerald-400">
                <Network className={`w-8 h-8 ${isOnline ? 'text-emerald-400' : 'text-gray-600'}`} />
              </div>
              <span className="text-xs font-bold text-emerald-400 tracking-wider">IGW (CORE)</span>
              <span className="text-[10px] text-gray-400 font-mono mt-0.5">Internet Gateway</span>
            </div>
          </div>

          {/* Summary Banner */}
          <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Network-Wide Average</p>
                <p className="text-sm font-mono text-white font-semibold">{averages.total_devices} devices · {averages.total_tests} tests (24h)</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Avg Latency to EBR</p>
                <p className={`text-lg font-bold font-mono ${avgPingEbr > 0 ? getLatencyColor(avgPingEbr) : 'text-gray-500'}`}>
                  {avgPingEbr > 0 ? `${avgPingEbr.toFixed(1)} ms` : '-'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Avg Latency to IGW</p>
                <p className={`text-lg font-bold font-mono ${avgPingIgw > 0 ? getLatencyColor(avgPingIgw) : 'text-gray-500'}`}>
                  {avgPingIgw > 0 ? `${avgPingIgw.toFixed(1)} ms` : '-'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <style jsx>{`
          @keyframes dash {
            to { stroke-dashoffset: -40; }
          }
          .animate-dash {
            stroke-dasharray: 8 6;
            animation: dash linear infinite;
          }
        `}</style>
      </div>

      {/* ===== KPI CARDS ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Avg Latency (IGW)',
            value: formatMs(avgPingIgw),
            icon: Zap,
            color: 'from-cyan-500 to-blue-600',
            glow: 'shadow-cyan-500/20',
            textColor: 'text-cyan-400'
          },
          {
            label: 'Avg Download',
            value: formatMbps(averages.avg_download_speed),
            icon: Download,
            color: 'from-emerald-500 to-green-600',
            glow: 'shadow-emerald-500/20',
            textColor: 'text-emerald-400'
          },
          {
            label: 'Avg Upload',
            value: formatMbps(averages.avg_upload_speed),
            icon: Upload,
            color: 'from-purple-500 to-pink-600',
            glow: 'shadow-purple-500/20',
            textColor: 'text-purple-400'
          },
          {
            label: 'Success Rate',
            value: formatPct(averages.success_rate),
            icon: TrendingUp,
            color: avgPingIgw > 0 && avgPingIgw < 50 ? 'from-emerald-500 to-green-600' : 'from-rose-500 to-red-600',
            glow: 'shadow-rose-500/20',
            textColor: averages.success_rate > 90 ? 'text-emerald-400' : 'text-rose-400'
          }
        ].map((card, i) => (
          <div key={i} className="relative group">
            <div className={`absolute -inset-0.5 bg-gradient-to-r ${card.color} rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-300 ${card.glow}`} />
            <div className="relative bg-[#0f0f1a]/90 backdrop-blur-xl rounded-xl border border-white/10 p-4 hover:border-white/20 transition-all duration-300">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider">{card.label}</span>
                <card.icon className={`w-4 h-4 ${card.textColor}`} />
              </div>
              <p className={`text-xl font-bold font-mono ${card.textColor}`}>{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Additional mini KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Avg Packet Loss', value: formatPct(averages.avg_packet_loss), color: averages.avg_packet_loss > 2 ? 'text-rose-400' : 'text-emerald-400', icon: AlertTriangle },
          { label: 'Online Devices', value: `${averages.online_count}/${averages.total_devices}`, color: 'text-emerald-400', icon: Wifi },
          { label: 'Avg Latency (EBR)', value: formatMs(avgPingEbr), color: 'text-purple-400', icon: Activity },
          { label: 'Total Tests (24h)', value: averages.total_tests.toLocaleString(), color: 'text-blue-400', icon: TrendingDown }
        ].map((item, i) => (
          <div key={i} className="bg-[#0f0f1a]/80 backdrop-blur-md rounded-xl border border-white/5 p-3 flex items-center gap-3 hover:border-white/10 transition-all">
            <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center ${item.color}`}>
              <item.icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider truncate">{item.label}</p>
              <p className={`text-sm font-bold font-mono ${item.color} truncate`}>{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ===== TREND CHARTS ===== */}
      {trends.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Latency Trend */}
          <div className="bg-[#0a0b16] rounded-2xl border border-white/10 p-5 relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                Avg Latency Trend (24h)
              </h4>
              <ResponsiveContainer width="100%" height={180}>
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
                  <XAxis dataKey="hour" stroke="#4b5563" fontSize={10} tickLine={false} />
                  <YAxis stroke="#4b5563" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: '#1a1b2e',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      backdropFilter: 'blur(12px)'
                    }}
                    itemStyle={{ color: '#e5e7eb', fontSize: '12px' }}
                    labelStyle={{ color: '#9ca3af', fontSize: '11px' }}
                  />
                  <Area type="monotone" dataKey="avg_ping_igw" stroke="#22d3ee" strokeWidth={2} fill="url(#igwGrad)" name="IGW" dot={false} />
                  <Area type="monotone" dataKey="avg_ping_ebr" stroke="#a855f7" strokeWidth={2} fill="url(#ebrGrad)" name="EBR" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Speed Trend */}
          <div className="bg-[#0a0b16] rounded-2xl border border-white/10 p-5 relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                Avg Speed Trend (24h)
              </h4>
              <ResponsiveContainer width="100%" height={180}>
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
                  <XAxis dataKey="hour" stroke="#4b5563" fontSize={10} tickLine={false} />
                  <YAxis stroke="#4b5563" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: '#1a1b2e',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      backdropFilter: 'blur(12px)'
                    }}
                    itemStyle={{ color: '#e5e7eb', fontSize: '12px' }}
                    labelStyle={{ color: '#9ca3af', fontSize: '11px' }}
                  />
                  <Area type="monotone" dataKey="avg_download_speed" stroke="#10b981" strokeWidth={2} fill="url(#dlGrad)" name="Download" dot={false} />
                  <Area type="monotone" dataKey="avg_upload_speed" stroke="#f59e0b" strokeWidth={2} fill="url(#ulGrad)" name="Upload" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
