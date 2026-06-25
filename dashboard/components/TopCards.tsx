'use client'

import { Clock, Network, AlertCircle, Server } from 'lucide-react'

interface TopCardsProps {
  dashboardData: any
  dashboardV2: any
  ontBrandData: any[]
  ontTypeData: any[]
}

export default function TopCards({ dashboardData, dashboardV2, ontBrandData, ontTypeData }: TopCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* Latency */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-orange-500/20 p-4 shadow-lg shadow-orange-500/10">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-orange-400" />
          <span className="text-xs font-bold text-white uppercase">Latency</span>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-2">
          <div className="bg-slate-700/30 rounded-lg p-2 text-center">
            <div className="text-xl font-bold text-white">{dashboardData?.avgPingIgw || 0}</div>
            <div className="text-[9px] text-orange-300/70">IGW (ms)</div>
          </div>
          <div className="bg-slate-700/30 rounded-lg p-2 text-center">
            <div className="text-xl font-bold text-white">{dashboardData?.avgPingEbr || 0}</div>
            <div className="text-[9px] text-orange-300/70">EBR (ms)</div>
          </div>
        </div>
        <div className="flex gap-0.5 mb-2" style={{ height: '24px' }}>
          {(ontBrandData || []).map((b: any, i: number) => {
            const mx = Math.max(...(ontBrandData || []).map((x: any) => x.avg_igw_latency || 0))
            const h = mx > 0 ? ((b.avg_igw_latency || 0) / mx) * 22 : 3
            return <div key={i} className="flex-1 self-end"><div className="w-full rounded-t" style={{ height: h + 'px', backgroundColor: ['#f97316','#fb923c','#fdba74','#fed7aa'][i % 5] }} /></div>
          })}
        </div>
        <div className="grid grid-cols-3 gap-1 text-[9px] pt-2 border-t border-slate-700/50">
          <div><span className="text-gray-500">High:</span> <span className="text-red-400 font-bold">{dashboardV2?.kpi?.l1_alarm || 0}</span></div>
          <div><span className="text-gray-500">Tests:</span> <span className="text-white">{dashboardData?.totalTests || 0}</span></div>
          <div><span className="text-gray-500">Success:</span> <span className="text-green-400">{dashboardData?.successRate || 0}%</span></div>
        </div>
      </div>

      {/* Speed */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-cyan-500/20 p-4 shadow-lg shadow-cyan-500/10">
        <div className="flex items-center gap-2 mb-3">
          <Network className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold text-white uppercase">Speed</span>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-2">
          <div className="bg-slate-700/30 rounded-lg p-2 text-center">
            <div className="text-xl font-bold text-white">{dashboardData?.avgDownload || 0}</div>
            <div className="text-[9px] text-cyan-300/70">Download (Mbps)</div>
          </div>
          <div className="bg-slate-700/30 rounded-lg p-2 text-center">
            <div className="text-xl font-bold text-white">{dashboardData?.avgUpload || 0}</div>
            <div className="text-[9px] text-cyan-300/70">Upload (Mbps)</div>
          </div>
        </div>
        <div className="flex gap-0.5 mb-2" style={{ height: '24px' }}>
          {(ontBrandData || []).map((b: any, i: number) => {
            const mx = Math.max(...(ontBrandData || []).map((x: any) => x.avg_download || 0))
            const h = mx > 0 ? ((b.avg_download || 0) / mx) * 22 : 3
            return <div key={i} className="flex-1 self-end"><div className="w-full rounded-t" style={{ height: h + 'px', backgroundColor: ['#06b6d4','#22d3ee','#67e8f9','#a5f3fc'][i % 5] }} /></div>
          })}
        </div>
        <div className="grid grid-cols-3 gap-1 text-[9px] pt-2 border-t border-slate-700/50">
          <div><span className="text-gray-500">Below:</span> <span className="text-amber-400 font-bold">{dashboardV2?.kpi?.l2_alarm || 0}</span></div>
          <div><span className="text-gray-500">DL max:</span> <span className="text-white">{dashboardData?.speedStats?.download?.max || 0}</span></div>
          <div><span className="text-gray-500">UL max:</span> <span className="text-white">{dashboardData?.speedStats?.upload?.max || 0}</span></div>
        </div>
      </div>

      {/* Packet Loss */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-pink-500/20 p-4 shadow-lg shadow-pink-500/10">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle className="w-4 h-4 text-pink-400" />
          <span className="text-xs font-bold text-white uppercase">Packet Loss</span>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-2">
          <div className="bg-slate-700/30 rounded-lg p-2 text-center">
            <div className="text-xl font-bold text-white">{dashboardData?.avgPacketLoss || 0}</div>
            <div className="text-[9px] text-pink-300/70">Packet Loss (%)</div>
          </div>
          <div className="bg-slate-700/30 rounded-lg p-2 text-center">
            <div className="text-xl font-bold text-white">{dashboardData?.activeAlerts || 0}</div>
            <div className="text-[9px] text-pink-300/70">Active Alarms</div>
          </div>
        </div>
        <div className="flex gap-0.5 mb-2" style={{ height: '24px' }}>
          {(ontTypeData || []).map((t: any, i: number) => {
            const mx = Math.max(...(ontTypeData || []).map((x: any) => x.avg_packet_loss_igw || 0))
            const h = mx > 0 ? ((t.avg_packet_loss_igw || 0) / mx) * 22 : 3
            return <div key={i} className="flex-1 self-end"><div className="w-full rounded-t" style={{ height: h + 'px', backgroundColor: ['#ec4899','#f472b6','#f9a8d4','#fbcfe8'][i % 5] }} /></div>
          })}
        </div>
        <div className="grid grid-cols-3 gap-1 text-[9px] pt-2 border-t border-slate-700/50">
          <div><span className="text-gray-500">Online:</span> <span className="text-green-400 font-bold">{dashboardData?.deviceStatus?.online || 0}</span></div>
          <div><span className="text-gray-500">Offline:</span> <span className="text-red-400 font-bold">{dashboardData?.deviceStatus?.offline || 0}</span></div>
          <div><span className="text-gray-500">Total:</span> <span className="text-white">{dashboardData?.totalDevices || 0}</span></div>
        </div>
      </div>

      {/* Devices */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-purple-500/20 p-4 shadow-lg shadow-purple-500/10">
        <div className="flex items-center gap-2 mb-3">
          <Server className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-bold text-white uppercase">Devices</span>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-2">
          <div className="bg-slate-700/30 rounded-lg p-2 text-center">
            <div className="text-xl font-bold text-white">{dashboardData?.totalDevices || 0}</div>
            <div className="text-[9px] text-purple-300/70">Total Devices</div>
          </div>
          <div className="bg-slate-700/30 rounded-lg p-2 text-center">
            <div className="text-xl font-bold text-white">{dashboardData?.successRate || 0}%</div>
            <div className="text-[9px] text-purple-300/70">Success Rate</div>
          </div>
        </div>
        <div className="flex gap-0.5 mb-2" style={{ height: '24px' }}>
          {(ontTypeData || []).map((t: any, i: number) => {
            const mx = Math.max(...(ontTypeData || []).map((x: any) => x.total_devices || 0))
            const h = mx > 0 ? ((t.total_devices || 0) / mx) * 22 : 3
            return <div key={i} className="flex-1 self-end"><div className="w-full rounded-t" style={{ height: h + 'px', backgroundColor: ['#a855f7','#c084fc','#d8b4fe','#e9d5ff'][i % 5] }} /></div>
          })}
        </div>
        <div className="grid grid-cols-3 gap-1 text-[9px] pt-2 border-t border-slate-700/50">
          <div><span className="text-gray-500">Total:</span> <span className="text-white font-bold">{dashboardData?.totalDevices || 0}</span></div>
          <div><span className="text-gray-500">Online:</span> <span className="text-green-400 font-bold">{dashboardData?.deviceStatus?.online || 0}</span></div>
          <div><span className="text-gray-500">Offline:</span> <span className="text-red-400 font-bold">{dashboardData?.deviceStatus?.offline || 0}</span></div>
        </div>
      </div>
    </div>
  )
}