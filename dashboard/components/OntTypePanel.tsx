'use client'

import { useEffect, useState } from 'react'
import {
  Wifi, WifiOff, Download, Upload, Zap, Activity, AlertTriangle, TrendingUp
} from 'lucide-react'
import OntArchitectureDiagram from './OntArchitectureDiagram'

interface OntTypeData {
  name: string
  total_devices: number
  online_devices: number
  avg_download: number
  avg_upload: number
  avg_igw_latency: number
  avg_ebr_latency: number
  avg_packet_loss_igw: number
}

interface OntTypePanelProps {
  areaId?: number | null
  regionalId?: number | null
  nopId?: number | null
}

const datasheetUrls: Record<string, string> = {
  'F670L': 'http://ztegpon.cz/pdf/ZXHN%20F670L%20datasheet.pdf',
}

export default function OntTypePanel({ areaId, regionalId, nopId }: OntTypePanelProps) {
  const [ontTypes, setOntTypes] = useState<OntTypeData[]>([])
  const [selected, setSelected] = useState<OntTypeData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams()
    if (areaId) params.set('areaId', areaId.toString())
    if (regionalId) params.set('regionalId', regionalId.toString())
    if (nopId) params.set('nopId', nopId.toString())
    const qs = params.toString()

    setLoading(true)
    fetch(`/api/dashboard/ont-type-comparison${qs ? `?${qs}` : ''}`)
      .then(r => r.json())
      .then(res => {
        const data = (res.data || []).filter((d: OntTypeData) => d.name)
        setOntTypes(data)
        if (data.length > 0 && !selected) setSelected(data[0])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [areaId, regionalId, nopId])

  const num = (v: any) => { const n = Number(v); return isNaN(n) ? 0 : n }
  const formatMs = (v: any) => { const n = num(v); return n ? `${n.toFixed(1)} ms` : '-' }
  const formatMbps = (v: any) => { const n = num(v); return n ? `${n.toFixed(1)} Mbps` : '-' }
  const formatPct = (v: any) => `${num(v).toFixed(1)}%`

  const getLatencyColor = (ms: any) => {
    const n = num(ms)
    if (n < 15) return 'text-emerald-400'
    if (n < 50) return 'text-amber-400'
    return 'text-rose-400'
  }

  return (
    <div className="bg-[#0a0b16] rounded-xl border border-white/10 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
        <Activity className="w-3.5 h-3.5 text-cyan-400" />
        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">ONT Types</span>
        <span className="text-[9px] text-gray-500 ml-auto">{ontTypes.length} types</span>
      </div>

      {loading ? (
        <div className="p-3 space-y-2">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-10 bg-white/5 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : ontTypes.length === 0 ? (
        <div className="p-6 text-center text-gray-500 text-xs">No ONT type data available</div>
      ) : (
        <div className="flex flex-col lg:flex-row">
          {/* ONT Type List */}
          <div className="lg:w-2/5 border-b lg:border-b-0 lg:border-r border-white/5 max-h-[400px] lg:max-h-[540px] overflow-y-auto">
            {ontTypes.map((ont) => (
              <button
                key={ont.name}
                onClick={() => setSelected(ont)}
                className={`w-full text-left px-3 py-2.5 border-b border-white/5 last:border-0 transition-colors hover:bg-white/5 ${
                  selected?.name === ont.name ? 'bg-white/10 border-l-2 border-l-cyan-400' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-200">{ont.name}</span>
                  <span className="text-[10px] text-gray-500 font-mono">{ont.total_devices} devices</span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[10px]">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <Wifi className="w-2.5 h-2.5" />{ont.online_devices}
                  </span>
                  {ont.total_devices - ont.online_devices > 0 && (
                    <span className="flex items-center gap-1 text-rose-400">
                      <WifiOff className="w-2.5 h-2.5" />{ont.total_devices - ont.online_devices}
                    </span>
                  )}
                  <span className={`font-mono ${getLatencyColor(ont.avg_igw_latency)}`}>
                    {formatMs(ont.avg_igw_latency)}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Detail Panel */}
          <div className="lg:w-3/5 p-3 space-y-2 overflow-y-auto max-h-[400px] lg:max-h-[540px]">
            {selected && (
              <>
                {/* Datasheet PDF / Architecture Diagram */}
                <div className="bg-[#0f0f1a]/80 rounded-lg border border-white/5 overflow-hidden" style={{ height: 300 }}>
                  {datasheetUrls[selected.name] ? (
                    <embed
                      src={datasheetUrls[selected.name]}
                      type="application/pdf"
                      width="100%"
                      height="100%"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <OntArchitectureDiagram
                        manufacturer={selected.name}
                        model={selected.name}
                        pingIgw={selected.avg_igw_latency}
                        pingEbr={selected.avg_ebr_latency}
                        status={selected.online_devices > 0 ? 'online' : 'offline'}
                      />
                    </div>
                  )}
                </div>

                {/* Tech Spec Summary */}
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: 'Avg Download', value: formatMbps(selected.avg_download), icon: Download, color: 'text-emerald-400' },
                    { label: 'Avg Upload', value: formatMbps(selected.avg_upload), icon: Upload, color: 'text-purple-400' },
                    { label: 'Avg Latency (IGW)', value: formatMs(selected.avg_igw_latency), icon: Zap, color: getLatencyColor(selected.avg_igw_latency) },
                    { label: 'Avg Latency (EBR)', value: formatMs(selected.avg_ebr_latency), icon: Zap, color: getLatencyColor(selected.avg_ebr_latency) },
                  ].map((s, i) => (
                    <div key={i} className="bg-[#0f0f1a]/60 rounded-lg border border-white/5 p-2">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <s.icon className={`w-3 h-3 ${s.color}`} />
                        <span className="text-[9px] text-gray-500 uppercase tracking-wider">{s.label}</span>
                      </div>
                      <p className={`text-sm font-bold font-mono ${s.color}`}>{s.value}</p>
                    </div>
                  ))}
                  <div className="bg-[#0f0f1a]/60 rounded-lg border border-white/5 p-2">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <AlertTriangle className={`w-3 h-3 ${selected.avg_packet_loss_igw > 2 ? 'text-rose-400' : 'text-emerald-400'}`} />
                      <span className="text-[9px] text-gray-500 uppercase tracking-wider">Packet Loss</span>
                    </div>
                    <p className={`text-sm font-bold font-mono ${selected.avg_packet_loss_igw > 2 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {formatPct(selected.avg_packet_loss_igw)}
                    </p>
                  </div>
                  <div className="bg-[#0f0f1a]/60 rounded-lg border border-white/5 p-2">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Activity className="w-3 h-3 text-cyan-400" />
                      <span className="text-[9px] text-gray-500 uppercase tracking-wider">Online Rate</span>
                    </div>
                    <p className="text-sm font-bold font-mono text-cyan-400">
                      {selected.total_devices > 0
                        ? `${(num(selected.online_devices) / num(selected.total_devices) * 100).toFixed(1)}%`
                        : '-'}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
