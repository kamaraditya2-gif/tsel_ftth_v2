'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

interface NetworkDiagramUpstream {
  avgDownload: number | string
  avgUpload: number | string
  avgLatency: number | string
  avgEbrLatency: number | string
}

interface NetworkDiagramDownstream {
  avgLatency: number | string
  avgPacketLoss: number | string
}

interface NetworkDiagramProps {
  upstream: NetworkDiagramUpstream
  downstream: NetworkDiagramDownstream
}

export default function NetworkDiagram({ upstream, downstream }: NetworkDiagramProps) {
  const [mode, setMode] = useState('upstream')
  const [show, setShow] = useState(false)
  const u = upstream
  const d = downstream

  if (!show) {
    return (
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setShow(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-xs text-gray-300 hover:bg-slate-700/50 hover:text-white transition-all">
          <Eye className="w-3.5 h-3.5" /> Show Network Visualization
        </button>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700/50 p-4 shadow-lg mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-white uppercase tracking-wider">Network Topology</span>
          <div className="inline-flex rounded-lg border border-slate-600 p-0.5 bg-slate-800/80">
            <button onClick={() => setMode('upstream')} className={'px-2.5 py-1 text-[10px] font-medium rounded-md transition-all ' + (mode === 'upstream' ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow' : 'text-gray-400 hover:text-white')}>
              Upstream
            </button>
            <button onClick={() => setMode('downstream')} className={'px-2.5 py-1 text-[10px] font-medium rounded-md transition-all ' + (mode === 'downstream' ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow' : 'text-gray-400 hover:text-white')}>
              Downstream
            </button>
          </div>
        </div>
        <button onClick={() => setShow(false)} className="text-[10px] text-gray-500 hover:text-white flex items-center gap-1">
          <EyeOff className="w-3 h-3" /> Hide
        </button>
      </div>

      {/* SVG Topology */}
      <svg viewBox="0 0 900 200" className="w-full" style={{ maxHeight: '180px' }}>
        <defs>
          <linearGradient id="gradOnt" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="gradEbr" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#d97706" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="gradIgw" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="gradFs" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0.1" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Background grid lines */}
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(148,163,184,0.03)" strokeWidth="0.5" />
        </pattern>
        <rect width="900" height="200" fill="url(#grid)" rx="12" />

        {/* Connection lines - Upstream */}
        {mode === 'upstream' ? (
          <>
            <path d="M 180,100 L 320,100" stroke="rgba(99,102,241,0.3)" strokeWidth="2" strokeDasharray="6,4" fill="none" />
            <path d="M 320,100 L 420,70 L 520,70" stroke="rgba(59,130,246,0.3)" strokeWidth="2" strokeDasharray="6,4" fill="none" />
            <path d="M 320,100 L 420,130 L 520,130" stroke="rgba(245,158,11,0.3)" strokeWidth="2" strokeDasharray="6,4" fill="none" />
            <path d="M 520,70 L 620,70" stroke="rgba(16,185,129,0.3)" strokeWidth="2" strokeDasharray="6,4" fill="none" />
            <path d="M 520,130 L 620,130" stroke="rgba(16,185,129,0.3)" strokeWidth="2" strokeDasharray="6,4" fill="none" />
            <polygon points="175,95 185,100 175,105" fill="rgba(99,102,241,0.6)" />
            <polygon points="515,65 525,70 515,75" fill="rgba(59,130,246,0.6)" />
            <polygon points="515,125 525,130 515,135" fill="rgba(245,158,11,0.6)" />
          </>
        ) : (
          <>
            <path d="M 680,70 L 520,70 L 420,100 L 320,100 L 180,100" stroke="rgba(16,185,129,0.3)" strokeWidth="2" strokeDasharray="6,4" fill="none" />
            <path d="M 680,130 L 520,130 L 420,100 L 320,100 L 180,100" stroke="rgba(16,185,129,0.3)" strokeWidth="2" strokeDasharray="6,4" fill="none" />
            <polygon points="185,95 175,100 185,105" fill="rgba(16,185,129,0.6)" />
          </>
        )}

        {/* ONT node */}
        <rect x="70" y="70" width="100" height="60" rx="10" fill="url(#gradOnt)" stroke="#6366f1" strokeWidth="1.5" />
        <text x="120" y="92" textAnchor="middle" fill="#a5b4fc" fontSize="13" fontWeight="bold" filter="url(#glow)">ONT</text>
        <text x="120" y="108" textAnchor="middle" fill="#64748b" fontSize="9">
          {mode === 'upstream' ? 'CPE Device / Test Origin' : 'Fping Target'}
        </text>
        <circle cx="120" cy="70" r="3" fill="#6366f1" opacity="0.8" />

        {/* EBR/BNG node */}
        <rect x="320" y="100" width="100" height="60" rx="10" fill="url(#gradEbr)" stroke="#f59e0b" strokeWidth="1.5" />
        <text x="370" y="122" textAnchor="middle" fill="#fcd34d" fontSize="13" fontWeight="bold" filter="url(#glow)">EBR/BNG</text>
        <text x="370" y="138" textAnchor="middle" fill="#64748b" fontSize="9">Edge Router</text>
        <text x="370" y="150" textAnchor="middle" fill="#f59e0b" fontSize="9">{u.avgEbrLatency || 0} ms</text>
        <circle cx="370" cy="100" r="3" fill="#f59e0b" opacity="0.8" />

        {/* IGW node */}
        <rect x="420" y="40" width="100" height="60" rx="10" fill="url(#gradIgw)" stroke="#3b82f6" strokeWidth="1.5" />
        <text x="470" y="62" textAnchor="middle" fill="#93c5fd" fontSize="13" fontWeight="bold" filter="url(#glow)">IGW</text>
        <text x="470" y="78" textAnchor="middle" fill="#64748b" fontSize="9">Internet Gateway</text>
        <text x="470" y="90" textAnchor="middle" fill="#3b82f6" fontSize="9">{u.avgLatency || 0} ms</text>
        <circle cx="470" cy="40" r="3" fill="#3b82f6" opacity="0.8" />

        {/* Difference indicator */}
        <rect x="395" y="165" width="150" height="22" rx="6" fill="rgba(148,163,184,0.08)" stroke="rgba(148,163,184,0.15)" strokeWidth="0.5" />
        <text x="470" y="179" textAnchor="middle" fill="#94a3b8" fontSize="9">
          Δ {Math.abs((Number(u.avgLatency)||0)-(Number(u.avgEbrLatency)||0))} ms
        </text>

        {/* File Server node */}
        <rect x="630" y="40" width="110" height="60" rx="10" fill="url(#gradFs)" stroke="#10b981" strokeWidth="1.5" />
        <text x="685" y="62" textAnchor="middle" fill="#6ee7b7" fontSize="11" fontWeight="bold" filter="url(#glow)">File Server</text>
        <text x="685" y="78" textAnchor="middle" fill="#64748b" fontSize="9">Speed / Latency Test</text>

        {/* File Server 2 */}
        <rect x="630" y="100" width="110" height="60" rx="10" fill="url(#gradFs)" stroke="#10b981" strokeWidth="1.5" />
        <text x="685" y="122" textAnchor="middle" fill="#6ee7b7" fontSize="11" fontWeight="bold" filter="url(#glow)">File Server</text>
        <text x="685" y="138" textAnchor="middle" fill="#64748b" fontSize="9">Latency / Packet Loss</text>

        {/* Values overlay */}
        {mode === 'upstream' ? (
          <>
            <rect x="220" y="75" width="70" height="50" rx="6" fill="rgba(15,23,42,0.85)" stroke="rgba(6,182,212,0.2)" strokeWidth="0.5" />
            <text x="255" y="93" textAnchor="middle" fill="#67e8f9" fontSize="10" fontWeight="bold">{u.avgDownload || 0}</text>
            <text x="255" y="105" textAnchor="middle" fill="#64748b" fontSize="8">DL Mbps</text>
            <text x="255" y="119" textAnchor="middle" fill="#67e8f9" fontSize="10" fontWeight="bold">{u.avgUpload || 0}</text>
            <text x="255" y="131" textAnchor="middle" fill="#64748b" fontSize="8">UL Mbps</text>
          </>
        ) : (
          <>
            <rect x="220" y="75" width="70" height="50" rx="6" fill="rgba(15,23,42,0.85)" stroke="rgba(16,185,129,0.2)" strokeWidth="0.5" />
            <text x="255" y="93" textAnchor="middle" fill="#34d399" fontSize="10" fontWeight="bold">{d.avgLatency || 0}</text>
            <text x="255" y="105" textAnchor="middle" fill="#64748b" fontSize="8">Latency ms</text>
            <text x="255" y="119" textAnchor="middle" fill="#34d399" fontSize="10" fontWeight="bold">{d.avgPacketLoss || 0}%</text>
            <text x="255" y="131" textAnchor="middle" fill="#64748b" fontSize="8">Packet Loss</text>
          </>
        )}

        {/* Direction label */}
        <rect x="85" y="157" width="200" height="20" rx="4" fill={mode === 'upstream' ? 'rgba(59,130,246,0.1)' : 'rgba(16,185,129,0.1)'} />
        <text x="185" y="170" textAnchor="middle" fill={mode === 'upstream' ? '#60a5fa' : '#34d399'} fontSize="9">
          {mode === 'upstream' ? '▲ ONT initiates test → IGW/EBR → File Server' : '▼ File Server initiates ping → IGW/EBR → ONT'}
        </text>
      </svg>

      <div className="flex items-center justify-center gap-3 text-[8px] text-gray-500 mt-1">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500" /> ONT</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> EBR</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> IGW</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> File Server</span>
      </div>
    </div>
  )
}