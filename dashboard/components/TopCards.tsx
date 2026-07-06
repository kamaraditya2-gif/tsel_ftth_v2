'use client'

import { Clock, Network, AlertCircle, Server } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface AlarmBucket { total: number; byType: Record<string, number>; bySeverity: Record<string, number> }
interface TopCardsProps {
  dashboardData: any; dashboardV2: any; ontBrandData: any[]; ontTypeData: any[]
  alarmStats?: { active: AlarmBucket; cleared: AlarmBucket }
  filterParams?: { areaIds: string; regionalIds: string; nopIds: string }
}

const Bar = ({ pct, color }: { pct: number; color: string }) => (
  <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden mt-0.5">
    <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
  </div>
)

export default function TopCards({ dashboardData, dashboardV2, ontBrandData, ontTypeData, alarmStats, filterParams }: TopCardsProps) {
  const router = useRouter()
  const active = alarmStats?.active; const cleared = alarmStats?.cleared
  const actCritical = active?.bySeverity?.critical || 0; const actWarning = active?.bySeverity?.warning || 0
  const actSpeed = (active?.byType?.download || 0) + (active?.byType?.upload || 0)
  const actPacketLoss = active?.byType?.packet_loss || 0; const actTotal = active?.total || 0
  const sp = dashboardData?.speedProgress || {}; const pp = dashboardData?.pingProgress || {}

  const goAlarms = (tab?: string, severity?: string) => {
    const p = new URLSearchParams()
    if (tab) p.set('tab', tab); if (severity) p.set('severity', severity)
    if (filterParams?.areaIds) p.set('area_ids', filterParams.areaIds)
    if (filterParams?.regionalIds) p.set('regional_ids', filterParams.regionalIds)
    if (filterParams?.nopIds) p.set('nop_ids', filterParams.nopIds)
    router.push(`/alarms/v2?${p.toString()}`)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      {/* Latency + Packet Loss */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-orange-500/20 p-2 shadow-lg shadow-orange-500/10">
        <div className="flex items-center gap-1.5 mb-1">
          <Clock className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-xs font-bold text-white uppercase">Latency</span>
        </div>
        {/* Test Progress */}
        <div className="mb-1">
          <div className="flex justify-between text-[9px]">
            <span className="text-gray-500">Test Progress</span>
            <span className="text-orange-300">{pp.tested}/{pp.total} ({pp.total ? ((pp.tested / pp.total) * 100).toFixed(0) : 0}%)</span>
          </div>
          <Bar pct={pp.total ? (pp.tested / pp.total) * 100 : 0} color="bg-orange-500" />
        </div>
        {/* Stats */}
        <div className="grid grid-cols-2 gap-1 mb-1">
          <div className="bg-slate-700/30 rounded-md p-1 text-center">
            <div className="text-sm font-bold text-white">{dashboardData?.avgPingIgw || 0}</div>
            <div className="text-[8px] text-orange-300/70">IGW ms</div>
          </div>
          <div className="bg-slate-700/30 rounded-md p-1 text-center">
            <div className="text-sm font-bold text-white">{dashboardData?.avgPingEbr || 0}</div>
            <div className="text-[8px] text-orange-300/70">EBR ms</div>
          </div>
        </div>
        <div className="flex justify-between text-[9px] mb-0.5">
          <span className="text-gray-500">SR: <span className="text-emerald-400">{pp.successRate}%</span></span>
          <span className="text-gray-500">Pkt Loss: <span className="text-pink-400">{pp.avgPacketLoss}%</span></span>
        </div>
        <div className="grid grid-cols-3 gap-0.5 text-[9px] pt-1 border-t border-slate-700/50">
          <div><span className="text-gray-500">Critical:</span> <span className="text-red-400 font-bold cursor-pointer hover:underline" onClick={() => goAlarms('active', 'critical')}>{actCritical}</span></div>
          <div><span className="text-gray-500">Warning:</span> <span className="text-amber-400 cursor-pointer hover:underline" onClick={() => goAlarms('active', 'warning')}>{actWarning}</span></div>
          <div><span className="text-gray-500">Cleared:</span> <span className="text-green-400 cursor-pointer hover:underline" onClick={() => goAlarms('cleared')}>{cleared?.bySeverity?.critical || 0 + cleared?.bySeverity?.warning || 0}</span></div>
        </div>
      </div>

      {/* Speed */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-cyan-500/20 p-2 shadow-lg shadow-cyan-500/10">
        <div className="flex items-center gap-1.5 mb-1">
          <Network className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-bold text-white uppercase">Speed</span>
        </div>
        {/* DL Progress */}
        <div className="mb-1">
          <div className="flex justify-between text-[9px]">
            <span className="text-gray-500">DL Test</span>
            <span className="text-cyan-300">{sp.dlTested}/{sp.dlTotal} ({sp.dlTotal ? ((sp.dlTested / sp.dlTotal) * 100).toFixed(0) : 0}%)</span>
          </div>
          <Bar pct={sp.dlTotal ? (sp.dlTested / sp.dlTotal) * 100 : 0} color="bg-cyan-500" />
        </div>
        <div className="flex justify-between text-[9px] mb-0.5">
          <span className="text-gray-500">Above: <span className="text-emerald-400">{sp.dlAbove}</span> / Below: <span className="text-red-400">{sp.dlBelow}</span></span>
          <span className="text-gray-500">SR: <span className="text-cyan-300">{sp.dlSr}%</span></span>
        </div>
        {/* UL Progress */}
        <div className="mb-1">
          <div className="flex justify-between text-[9px]">
            <span className="text-gray-500">UL Test</span>
            <span className="text-purple-300">{sp.ulTested}/{sp.ulTotal} ({sp.ulTotal ? ((sp.ulTested / sp.ulTotal) * 100).toFixed(0) : 0}%)</span>
          </div>
          <Bar pct={sp.ulTotal ? (sp.ulTested / sp.ulTotal) * 100 : 0} color="bg-purple-500" />
        </div>
        <div className="flex justify-between text-[9px] mb-0.5">
          <span className="text-gray-500">Above: <span className="text-emerald-400">{sp.ulAbove}</span> / Below: <span className="text-red-400">{sp.ulBelow}</span></span>
          <span className="text-gray-500">SR: <span className="text-purple-300">{sp.ulSr}%</span></span>
        </div>
        <div className="grid grid-cols-3 gap-0.5 text-[9px] pt-1 border-t border-slate-700/50">
          <div><span className="text-gray-500">Alarm:</span> <span className="text-amber-400 font-bold cursor-pointer hover:underline" onClick={() => goAlarms('active')}>{actSpeed}</span></div>
          <div><span className="text-gray-500">Avg DL:</span> <span className="text-white">{dashboardData?.avgDownload || 0}</span></div>
          <div><span className="text-gray-500">Cleared:</span> <span className="text-green-400 cursor-pointer hover:underline" onClick={() => goAlarms('cleared')}>{(cleared?.byType?.download || 0) + (cleared?.byType?.upload || 0)}</span></div>
        </div>
      </div>

      {/* Packet Loss — merged into Latency, show summary here */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-pink-500/20 p-2 shadow-lg shadow-pink-500/10">
        <div className="flex items-center gap-1.5 mb-1">
          <AlertCircle className="w-3.5 h-3.5 text-pink-400" />
          <span className="text-xs font-bold text-white uppercase">Packet Loss</span>
        </div>
        <div className="grid grid-cols-2 gap-1 mb-1">
          <div className="bg-slate-700/30 rounded-md p-1 text-center">
            <div className="text-sm font-bold text-white">{dashboardData?.avgPacketLoss || 0}</div>
            <div className="text-[8px] text-pink-300/70">Avg Loss %</div>
          </div>
          <div className="bg-slate-700/30 rounded-md p-1 text-center">
            <div className="text-sm font-bold text-white">{dashboardData?.activeAlerts || 0}</div>
            <div className="text-[8px] text-pink-300/70">Alarms</div>
          </div>
        </div>
        <div className="flex gap-0.5 mb-1" style={{ height: '16px' }}>
          {(ontTypeData || []).map((t: any, i: number) => {
            const mx = Math.max(...(ontTypeData || []).map((x: any) => x.avg_packet_loss_igw || 0))
            const h = mx > 0 ? ((t.avg_packet_loss_igw || 0) / mx) * 14 : 3
            return <div key={i} className="flex-1 self-end"><div className="w-full rounded-t" style={{ height: h + 'px', backgroundColor: ['#ec4899','#f472b6','#f9a8d4','#fbcfe8'][i % 5] }} /></div>
          })}
        </div>
        <div className="grid grid-cols-3 gap-0.5 text-[9px] pt-1 border-t border-slate-700/50">
          <div><span className="text-gray-500">Alarm:</span> <span className="text-pink-400 font-bold cursor-pointer hover:underline" onClick={() => goAlarms()}>{actPacketLoss}</span></div>
          <div><span className="text-gray-500">Online:</span> <span className="text-green-400 font-bold">{dashboardData?.deviceStatus?.online || 0}</span></div>
          <div><span className="text-gray-500">Cleared:</span> <span className="text-green-400 cursor-pointer hover:underline" onClick={() => goAlarms('cleared')}>{cleared?.byType?.packet_loss || 0}</span></div>
        </div>
      </div>

      {/* Devices */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-purple-500/20 p-2 shadow-lg shadow-purple-500/10">
        <div className="flex items-center gap-1.5 mb-1">
          <Server className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-xs font-bold text-white uppercase">Devices</span>
        </div>
        <div className="flex items-center justify-between mb-1 px-1">
          <div>
            <div className="text-[9px] text-gray-500">Rate</div>
            <div className="text-lg font-bold text-purple-400">{dashboardData?.successRate || 0}%</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] text-gray-500">Total Up</div>
            <div className="text-sm font-bold text-emerald-400">{dashboardData?.deviceStatus?.online || 0}</div>
            <div className="text-[9px] text-gray-500 mt-0.5">Down</div>
            <div className="text-sm font-bold text-red-400">{dashboardData?.deviceStatus?.offline || 0}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-0.5 text-[9px] pt-1 border-t border-slate-700/50">
          <div><span className="text-gray-500">Total:</span> <span className="text-white font-bold">{dashboardData?.totalDevices || 0}</span></div>
          <div><span className="text-gray-500">Alarm:</span> <span className="text-purple-400 font-bold cursor-pointer hover:underline" onClick={() => goAlarms()}>{actTotal}</span></div>
          <div><span className="text-gray-500">Cleared:</span> <span className="text-green-400 cursor-pointer hover:underline" onClick={() => goAlarms('cleared')}>{cleared?.total || 0}</span></div>
        </div>
      </div>
    </div>
  )
}
