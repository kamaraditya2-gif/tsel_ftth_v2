'use client'

import { Clock, Network, AlertCircle, Server } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface AlarmBucket {
  total: number
  byType: Record<string, number>
  bySeverity: Record<string, number>
}

interface TopCardsProps {
  dashboardData: any
  dashboardV2: any
  ontBrandData: any[]
  ontTypeData: any[]
  alarmStats?: {
    active: AlarmBucket
    cleared: AlarmBucket
  }
}

export default function TopCards({ dashboardData, dashboardV2, ontBrandData, ontTypeData, alarmStats }: TopCardsProps) {
  const router = useRouter()
  const active = alarmStats?.active
  const cleared = alarmStats?.cleared

  // Active alarms
  const actCritical = active?.bySeverity?.critical || 0
  const actWarning = active?.bySeverity?.warning || 0
  const actSpeed = (active?.byType?.download || 0) + (active?.byType?.upload || 0)
  const actPacketLoss = active?.byType?.packet_loss || 0
  const actTotal = active?.total || 0

  // Cleared alarms (last timeRange)
  const clrCritical = cleared?.bySeverity?.critical || 0
  const clrWarning = cleared?.bySeverity?.warning || 0
  const clrSpeed = (cleared?.byType?.download || 0) + (cleared?.byType?.upload || 0)
  const clrPacketLoss = cleared?.byType?.packet_loss || 0
  const clrTotal = cleared?.total || 0

  const goAlarms = (tab?: string, severity?: string) => router.push(`/alarms/v2?tab=${tab || ''}&severity=${severity || ''}`)
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      {/* Latency */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-orange-500/20 p-2 shadow-lg shadow-orange-500/10">
        <div className="flex items-center gap-1.5 mb-1">
          <Clock className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-xs font-bold text-white uppercase">Avg. Latency</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 mb-1">
          <div className="bg-slate-700/30 rounded-md p-1 text-center">
            <div className="text-base font-bold text-white">{dashboardData?.avgPingIgw || 0}</div>
            <div className="text-[9px] text-orange-300/70">IGW ms</div>
          </div>
          <div className="bg-slate-700/30 rounded-md p-1 text-center">
            <div className="text-base font-bold text-white">{dashboardData?.avgPingEbr || 0}</div>
            <div className="text-[9px] text-orange-300/70">EBR ms</div>
          </div>
        </div>
        <div className="flex gap-0.5 mb-1" style={{ height: '20px' }}>
          {(ontBrandData || []).map((b: any, i: number) => {
            const mx = Math.max(...(ontBrandData || []).map((x: any) => x.avg_igw_latency || 0))
            const h = mx > 0 ? ((b.avg_igw_latency || 0) / mx) * 18 : 3
            return <div key={i} className="flex-1 self-end"><div className="w-full rounded-t" style={{ height: h + 'px', backgroundColor: ['#f97316','#fb923c','#fdba74','#fed7aa'][i % 5] }} /></div>
          })}
        </div>
        <div className="grid grid-cols-3 gap-0.5 text-[9px] pt-1 border-t border-slate-700/50">
          <div><span className="text-gray-500">Critical:</span> <span className="text-red-400 font-bold cursor-pointer hover:underline" onClick={() => goAlarms('active', 'critical')}>{actCritical}</span></div>
          <div><span className="text-gray-500">Warning:</span> <span className="text-amber-400 cursor-pointer hover:underline" onClick={() => goAlarms('active', 'warning')}>{actWarning}</span></div>
          <div><span className="text-gray-500">Cleared:</span> <span className="text-green-400 cursor-pointer hover:underline" onClick={() => goAlarms('cleared')}>{clrCritical + clrWarning}</span></div>
        </div>
      </div>

      {/* Speed */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-cyan-500/20 p-2 shadow-lg shadow-cyan-500/10">
        <div className="flex items-center gap-1.5 mb-1">
          <Network className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-bold text-white uppercase">Speed</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 mb-1">
          <div className="bg-slate-700/30 rounded-md p-1 text-center">
            <div className="text-base font-bold text-white">{dashboardData?.avgDownload || 0}</div>
            <div className="text-[9px] text-cyan-300/70">DL Mbps</div>
          </div>
          <div className="bg-slate-700/30 rounded-md p-1 text-center">
            <div className="text-base font-bold text-white">{dashboardData?.avgUpload || 0}</div>
            <div className="text-[9px] text-cyan-300/70">UL Mbps</div>
          </div>
        </div>
        <div className="flex gap-0.5 mb-1" style={{ height: '20px' }}>
          {(ontBrandData || []).map((b: any, i: number) => {
            const mx = Math.max(...(ontBrandData || []).map((x: any) => x.avg_download || 0))
            const h = mx > 0 ? ((b.avg_download || 0) / mx) * 18 : 3
            return <div key={i} className="flex-1 self-end"><div className="w-full rounded-t" style={{ height: h + 'px', backgroundColor: ['#06b6d4','#22d3ee','#67e8f9','#a5f3fc'][i % 5] }} /></div>
          })}
        </div>
        <div className="grid grid-cols-3 gap-0.5 text-[9px] pt-1 border-t border-slate-700/50">
          <div><span className="text-gray-500">Alarm:</span> <span className="text-amber-400 font-bold cursor-pointer hover:underline" onClick={() => goAlarms('active')}>{actSpeed}</span></div>
          <div><span className="text-gray-500">DL:</span> <span className="text-white">{dashboardData?.avgDownload || 0}</span></div>
          <div><span className="text-gray-500">Cleared:</span> <span className="text-green-400 cursor-pointer hover:underline" onClick={() => goAlarms('cleared')}>{clrSpeed}</span></div>
        </div>
      </div>

      {/* Packet Loss */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-pink-500/20 p-2 shadow-lg shadow-pink-500/10">
        <div className="flex items-center gap-1.5 mb-1">
          <AlertCircle className="w-3.5 h-3.5 text-pink-400" />
          <span className="text-xs font-bold text-white uppercase">Packet Loss</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 mb-1">
          <div className="bg-slate-700/30 rounded-md p-1 text-center">
            <div className="text-base font-bold text-white">{dashboardData?.avgPacketLoss || 0}</div>
            <div className="text-[9px] text-pink-300/70">Loss %</div>
          </div>
          <div className="bg-slate-700/30 rounded-md p-1 text-center">
            <div className="text-base font-bold text-white">{dashboardData?.activeAlerts || 0}</div>
            <div className="text-[9px] text-pink-300/70">Alarms</div>
          </div>
        </div>
        <div className="flex gap-0.5 mb-1" style={{ height: '20px' }}>
          {(ontTypeData || []).map((t: any, i: number) => {
            const mx = Math.max(...(ontTypeData || []).map((x: any) => x.avg_packet_loss_igw || 0))
            const h = mx > 0 ? ((t.avg_packet_loss_igw || 0) / mx) * 18 : 3
            return <div key={i} className="flex-1 self-end"><div className="w-full rounded-t" style={{ height: h + 'px', backgroundColor: ['#ec4899','#f472b6','#f9a8d4','#fbcfe8'][i % 5] }} /></div>
          })}
        </div>
        <div className="grid grid-cols-3 gap-0.5 text-[9px] pt-1 border-t border-slate-700/50">
          <div><span className="text-gray-500">Alarm:</span> <span className="text-pink-400 font-bold cursor-pointer hover:underline" onClick={() => goAlarms()}>{actPacketLoss}</span></div>
          <div><span className="text-gray-500">Online:</span> <span className="text-green-400 font-bold">{dashboardData?.deviceStatus?.online || 0}</span></div>
          <div><span className="text-gray-500">Cleared:</span> <span className="text-green-400 cursor-pointer hover:underline" onClick={() => goAlarms('cleared')}>{clrPacketLoss}</span></div>
        </div>
      </div>

      {/* Devices */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-purple-500/20 p-2 shadow-lg shadow-purple-500/10">
        <div className="flex items-center gap-1.5 mb-1">
          <Server className="w-3 h-3 text-purple-400" />
          <span className="text-[10px] font-bold text-white uppercase">Devices</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 mb-1">
          <div className="bg-slate-700/30 rounded-md p-1 text-center">
            <div className="text-base font-bold text-white">{dashboardData?.totalDevices || 0}</div>
            <div className="text-[9px] text-purple-300/70">Total</div>
          </div>
          <div className="bg-slate-700/30 rounded-md p-1 text-center">
            <div className="text-base font-bold text-white">{dashboardData?.successRate || 0}%</div>
            <div className="text-[9px] text-purple-300/70">Rate</div>
          </div>
        </div>
        <div className="flex gap-0.5 mb-1" style={{ height: '20px' }}>
          {(ontTypeData || []).map((t: any, i: number) => {
            const mx = Math.max(...(ontTypeData || []).map((x: any) => x.total_devices || 0))
            const h = mx > 0 ? ((t.total_devices || 0) / mx) * 18 : 3
            return <div key={i} className="flex-1 self-end"><div className="w-full rounded-t" style={{ height: h + 'px', backgroundColor: ['#a855f7','#c084fc','#d8b4fe','#e9d5ff'][i % 5] }} /></div>
          })}
        </div>
        <div className="grid grid-cols-3 gap-0.5 text-[9px] pt-1 border-t border-slate-700/50">
          <div><span className="text-gray-500">Alarm:</span> <span className="text-purple-400 font-bold cursor-pointer hover:underline" onClick={() => goAlarms()}>{actTotal}</span></div>
          <div><span className="text-gray-500">Critical:</span> <span className="text-red-400 font-bold cursor-pointer hover:underline" onClick={() => goAlarms('active', 'critical')}>{actCritical}</span></div>
          <div><span className="text-gray-500">Cleared:</span> <span className="text-green-400 cursor-pointer hover:underline" onClick={() => goAlarms('cleared')}>{clrTotal}</span></div>
        </div>
      </div>
    </div>
  )
}