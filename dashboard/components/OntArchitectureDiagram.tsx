'use client'

import { Activity, Server, Cpu, Database, Network } from 'lucide-react'

interface OntArchitectureDiagramProps {
  manufacturer?: string | null
  model?: string | null
  ipAddress?: string | null
  serialNumber?: string | null
  pingIgw?: number | null
  pingEbr?: number | null
  status?: string | null
}

export default function OntArchitectureDiagram({
  manufacturer = 'Generic',
  model = 'ONT CPE',
  ipAddress = '10.0.0.1',
  serialNumber = 'N/A',
  pingIgw = null,
  pingEbr = null,
  status = 'online'
}: OntArchitectureDiagramProps) {
  const isOnline = status === 'online' || status === 'active' || (pingIgw !== null || pingEbr !== null)

  // Calculate segment latencies
  const ontToOlt = isOnline ? 1.2 : null
  const oltToEbr = pingEbr !== null ? Math.max(0.5, pingEbr - 1.2) : (isOnline ? 8.5 : null)
  
  let ebrToIgw = null
  if (pingIgw !== null && pingEbr !== null) {
    ebrToIgw = Math.max(0.5, pingIgw - pingEbr)
  } else if (pingIgw !== null) {
    ebrToIgw = Math.max(0.5, pingIgw - 10)
  } else if (isOnline) {
    ebrToIgw = 12.3
  }

  // Choose colors/glows based on status/latency
  const getLatencyColor = (ms: number | null) => {
    if (ms === null) return 'text-gray-500'
    if (ms < 15) return 'text-emerald-400'
    if (ms < 50) return 'text-amber-400'
    return 'text-rose-400'
  }

  const getStrokeColor = (ms: number | null) => {
    if (!isOnline) return '#ef4444' // Red if offline
    if (ms === null) return '#4b5563' // Gray if null
    if (ms < 15) return '#10b981' // Green
    if (ms < 50) return '#f59e0b' // Yellow
    return '#ef4444' // Red
  }

  // Draw vendor specific ONT graphic using inline SVG
  const renderOntGraphic = () => {
    const brand = (manufacturer || '').toLowerCase()
    
    if (brand.includes('huawei')) {
      return (
        <svg className="w-24 h-24 drop-shadow-[0_0_12px_rgba(34,211,238,0.3)]" viewBox="0 0 100 100" fill="none">
          {/* Huawei style sleek white flat router with 4 neon antennas */}
          <path d="M15 65 L25 25 M35 65 L40 15 M65 65 L60 15 M85 65 L75 25" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" opacity={isOnline ? 1 : 0.4} />
          <rect x="10" y="60" width="80" height="25" rx="5" fill="#1e1e2f" stroke="#3b82f6" strokeWidth="2" />
          <ellipse cx="50" cy="72" rx="35" ry="5" fill="#0f172a" />
          {/* Status LEDs */}
          <circle cx="20" cy="72" r="2" fill={isOnline ? "#10b981" : "#ef4444"} className="animate-pulse" />
          <circle cx="28" cy="72" r="2" fill={isOnline ? "#10b981" : "#4b5563"} />
          <circle cx="36" cy="72" r="2" fill={isOnline ? "#22d3ee" : "#4b5563"} className="animate-pulse" />
          <circle cx="44" cy="72" r="2" fill={isOnline ? "#22d3ee" : "#4b5563"} />
          <text x="50" y="93" fill="#9ca3af" fontSize="7" textAnchor="middle" fontWeight="bold">HUAWEI ONT</text>
        </svg>
      )
    }
    
    if (brand.includes('zte')) {
      return (
        <svg className="w-24 h-24 drop-shadow-[0_0_12px_rgba(168,85,247,0.3)]" viewBox="0 0 100 100" fill="none">
          {/* ZTE style vertical sleek tower router */}
          <path d="M50 20 L25 80 L75 80 Z" fill="#1e1e2f" stroke="#a855f7" strokeWidth="2" />
          <line x1="50" y1="20" x2="50" y2="80" stroke="#a855f7" strokeWidth="1" strokeDasharray="2 2" />
          <rect x="47" y="30" width="6" height="30" rx="3" fill="#0f172a" stroke="#a855f7" strokeWidth="1" />
          {/* Glowing strip */}
          <line x1="50" y1="35" x2="50" y2="55" stroke={isOnline ? "#a855f7" : "#ef4444"} strokeWidth="2" strokeLinecap="round" className="animate-pulse" />
          <text x="50" y="93" fill="#9ca3af" fontSize="7" textAnchor="middle" fontWeight="bold">ZTE ONT</text>
        </svg>
      )
    }

    if (brand.includes('nokia')) {
      return (
        <svg className="w-24 h-24 drop-shadow-[0_0_12px_rgba(236,72,153,0.3)]" viewBox="0 0 100 100" fill="none">
          {/* Nokia style modern cylinder gateway */}
          <ellipse cx="50" cy="25" rx="20" ry="8" fill="#1e1e2f" stroke="#ec4899" strokeWidth="2" />
          <path d="M30 25 L30 75 A20 8 0 0 0 70 75 L70 25" fill="#1e1e2f" stroke="#ec4899" strokeWidth="2" />
          <ellipse cx="50" cy="75" rx="20" ry="8" fill="#0f172a" stroke="#ec4899" strokeWidth="1" />
          {/* Glowing Status Ring */}
          <ellipse cx="50" cy="50" rx="19" ry="4" stroke={isOnline ? "#ec4899" : "#ef4444"} strokeWidth="2" className="animate-pulse" />
          <text x="50" y="93" fill="#9ca3af" fontSize="7" textAnchor="middle" fontWeight="bold">NOKIA ONT</text>
        </svg>
      )
    }

    // Default/Fiberhome style robust rectangular white router
    return (
      <svg className="w-24 h-24 drop-shadow-[0_0_12px_rgba(59,130,246,0.3)]" viewBox="0 0 100 100" fill="none">
        <rect x="15" y="45" width="70" height="35" rx="6" fill="#1e1e2f" stroke="#3b82f6" strokeWidth="2.5" />
        <rect x="25" y="40" width="15" height="5" fill="#3b82f6" rx="1" />
        <rect x="60" y="40" width="15" height="5" fill="#3b82f6" rx="1" />
        {/* Antennas */}
        <line x1="25" y1="40" x2="15" y2="15" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
        <line x1="75" y1="40" x2="85" y2="15" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
        {/* LEDs */}
        <circle cx="35" cy="62" r="2.5" fill={isOnline ? "#10b981" : "#ef4444"} className="animate-pulse" />
        <circle cx="45" cy="62" r="2.5" fill={isOnline ? "#10b981" : "#4b5563"} />
        <circle cx="55" cy="62" r="2.5" fill={isOnline ? "#10b981" : "#4b5563"} />
        <circle cx="65" cy="62" r="2.5" fill={isOnline ? "#10b981" : "#4b5563"} />
        <text x="50" y="93" fill="#9ca3af" fontSize="7" textAnchor="middle" fontWeight="bold">FIBERHOME ONT</text>
      </svg>
    )
  }

  return (
    <div className="bg-[#0b0c16] rounded-2xl border border-white/10 p-6 shadow-xl relative overflow-hidden mb-6">
      {/* Background glow orbs */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

      <h4 className="text-sm font-semibold text-gray-300 mb-6 uppercase tracking-wider flex items-center gap-2">
        <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
        Futuristic FTTH Architecture Diagram
      </h4>

      {/* Network chain diagram */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative px-4 py-8">
        
        {/* Animated Connecting SVG Lines */}
        <div className="absolute inset-0 hidden md:block pointer-events-none">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            {/* Path 1: ONT -> OLT */}
            <path
              d="M 120,70 L 220,70"
              stroke={getStrokeColor(ontToOlt)}
              strokeWidth="3"
              strokeDasharray={isOnline ? "8 6" : "none"}
              className={isOnline ? "animate-dash" : ""}
              style={{ animationDuration: '3s' }}
            />
            {/* Path 2: OLT -> EBR */}
            <path
              d="M 320,70 L 420,70"
              stroke={getStrokeColor(oltToEbr)}
              strokeWidth="3"
              strokeDasharray={isOnline ? "8 6" : "none"}
              className={isOnline ? "animate-dash" : ""}
              style={{ animationDuration: '2s' }}
            />
            {/* Path 3: EBR -> IGW */}
            <path
              d="M 520,70 L 620,70"
              stroke={getStrokeColor(ebrToIgw)}
              strokeWidth="3"
              strokeDasharray={isOnline ? "8 6" : "none"}
              className={isOnline ? "animate-dash" : ""}
              style={{ animationDuration: '1.2s' }}
            />
          </svg>
        </div>

        {/* Node 1: ONT */}
        <div className="flex flex-col items-center z-10 w-32 group">
          <div className="relative mb-2 transition-transform duration-300 group-hover:scale-105">
            {renderOntGraphic()}
            <div className="absolute top-1 right-1">
              <span className={`flex h-3.5 w-3.5 relative`}>
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></span>
              </span>
            </div>
          </div>
          <span className="text-xs font-bold text-cyan-400 tracking-wider">ONT (DEVICE)</span>
          <span className="text-[10px] text-gray-400 font-mono mt-0.5">{model}</span>
          <span className="text-[9px] text-gray-500 font-mono truncate max-w-full">{serialNumber}</span>
        </div>

        {/* Latency Segment 1 */}
        <div className="md:hidden flex items-center justify-center py-2">
          <div className="h-8 w-0.5 bg-gradient-to-b from-cyan-500 to-blue-500 animate-pulse"></div>
        </div>
        <div className="flex flex-col items-center bg-[#151726]/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/5 shadow-md -my-2 md:-mt-8 z-20">
          <span className="text-[8px] text-gray-500 uppercase tracking-widest">Fiber Link</span>
          <span className={`text-[11px] font-bold ${getLatencyColor(ontToOlt)}`}>
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

        {/* Latency Segment 2 */}
        <div className="md:hidden flex items-center justify-center py-2">
          <div className="h-8 w-0.5 bg-gradient-to-b from-blue-500 to-purple-500 animate-pulse"></div>
        </div>
        <div className="flex flex-col items-center bg-[#151726]/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/5 shadow-md -my-2 md:-mt-8 z-20">
          <span className="text-[8px] text-gray-500 uppercase tracking-widest">GPON Backhaul</span>
          <span className={`text-[11px] font-bold ${getLatencyColor(oltToEbr)}`}>
            {isOnline ? `${oltToEbr?.toFixed(1)} ms` : 'Offline'}
          </span>
        </div>

        {/* Node 3: EBR */}
        <div className="flex flex-col items-center z-10 w-32 group">
          <div className="w-18 h-18 rounded-2xl bg-gradient-to-br from-purple-900/40 to-slate-900/40 border border-purple-500/30 flex items-center justify-center mb-2 shadow-[0_0_15px_rgba(168,85,247,0.1)] transition-transform duration-300 group-hover:scale-105 group-hover:border-purple-400">
            <Cpu className={`w-8 h-8 ${isOnline ? 'text-purple-400' : 'text-gray-600'}`} />
          </div>
          <span className="text-xs font-bold text-purple-400 tracking-wider">EBR (EDGE)</span>
          <span className="text-[10px] text-gray-400 font-mono mt-0.5">Edge Broadband</span>
        </div>

        {/* Latency Segment 3 */}
        <div className="md:hidden flex items-center justify-center py-2">
          <div className="h-8 w-0.5 bg-gradient-to-b from-purple-500 to-emerald-500 animate-pulse"></div>
        </div>
        <div className="flex flex-col items-center bg-[#151726]/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/5 shadow-md -my-2 md:-mt-8 z-20">
          <span className="text-[8px] text-gray-500 uppercase tracking-widest">Metro Transit</span>
          <span className={`text-[11px] font-bold ${getLatencyColor(ebrToIgw)}`}>
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

      {/* Latency summary banner */}
      {isOnline && (
        <div className="mt-6 p-4 bg-white/5 rounded-xl border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400">IP Address / Gateway IP</p>
              <p className="text-sm font-mono text-white font-semibold">{ipAddress}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Total Latency to EBR</p>
              <p className="text-lg font-bold text-purple-400 font-mono">{pingEbr !== null ? `${pingEbr.toFixed(1)} ms` : '-'}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Total Latency to IGW</p>
              <p className="text-lg font-bold text-cyan-400 font-mono">{pingIgw !== null ? `${pingIgw.toFixed(1)} ms` : '-'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Inline styles for SVG path animations */}
      <style jsx>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -40;
          }
        }
        .animate-dash {
          stroke-dasharray: 8 6;
          animation: dash linear infinite;
        }
      `}</style>
    </div>
  )
}
