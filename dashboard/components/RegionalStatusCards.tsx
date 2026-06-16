'use client'

import { useEffect, useState } from 'react'
import { MapPin, Activity, Wifi, WifiOff, Server, HardDrive, Clock } from 'lucide-react'

interface Region {
  id: number
  name: string
  location: string
  province: string
  status: string
  device_count: number
  last_ping_at: string | null
  is_connected: boolean
  recent_pings: number
  color: string
}

interface RegionalData {
  regions: Region[]
  summary: {
    total: number
    connected: number
    total_devices: number
    by_status: { active: number; inactive: number }
  }
}

export default function RegionalStatusCards() {
  const [data, setData] = useState<RegionalData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/regional-status')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="bg-[#0a0b16] rounded-2xl border border-white/10 p-6 mb-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-40 bg-white/5 rounded" />
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-16 bg-white/5 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!data) return null

  const { regions, summary } = data

  return (
    <div className="mb-6">
      {/* Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-[#0f0f1a]/90 backdrop-blur-md rounded-xl border border-white/10 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Server className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-gray-400 uppercase tracking-wider">Total Regions</span>
          </div>
          <p className="text-2xl font-bold text-white">{summary.total}</p>
        </div>
        <div className="bg-[#0f0f1a]/90 backdrop-blur-md rounded-xl border border-emerald-500/20 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Wifi className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-gray-400 uppercase tracking-wider">Connected</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{summary.connected}</p>
        </div>
        <div className="bg-[#0f0f1a]/90 backdrop-blur-md rounded-xl border border-white/10 p-4">
          <div className="flex items-center gap-2 mb-1">
            <HardDrive className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-gray-400 uppercase tracking-wider">Total Devices</span>
          </div>
          <p className="text-2xl font-bold text-white">{summary.total_devices}</p>
        </div>
        <div className="bg-[#0f0f1a]/90 backdrop-blur-md rounded-xl border border-white/10 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-gray-400 uppercase tracking-wider">Active / Inactive</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {summary.by_status.active}
            <span className="text-sm text-gray-500 font-normal"> / {summary.by_status.inactive}</span>
          </p>
        </div>
      </div>

      {/* Province Grid */}
      <div className="bg-[#0a0b16] rounded-2xl border border-white/10 p-5">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-cyan-400" />
          Regional Workers Map
          <span className="text-[10px] text-gray-500 font-normal normal-case">(34 Provinsi)</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {regions.map(region => {
            const connected = region.is_connected && region.recent_pings > 0
            return (
              <div
                key={region.id}
                className={`relative rounded-xl p-3 border transition-all duration-200 ${
                  connected
                    ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                {/* Status indicator */}
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-xs font-bold tracking-wider ${
                    connected ? 'text-emerald-400' : 'text-gray-500'
                  }`}>
                    {region.id === 1 ? 'PUSAT' : region.name.replace('Downstream Server ', '').substring(0, 12)}
                  </span>
                  {connected ? (
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    </span>
                  ) : (
                    <WifiOff className="w-3 h-3 text-gray-600" />
                  )}
                </div>

                {/* Location */}
                <p className="text-[10px] text-gray-500 truncate">{region.location}</p>

                {/* ID Badge + Device Count */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400 font-mono">
                    ID:{region.id}
                  </span>
                  <span className="text-xs text-gray-400">
                    {region.device_count}{' '}
                    <span className="text-[9px]">ONT</span>
                  </span>
                </div>

                {/* Last ping */}
                {region.last_ping_at && (
                  <div className="flex items-center gap-1 mt-1 text-[9px] text-gray-600">
                    <Clock className="w-2.5 h-2.5" />
                    {new Date(region.last_ping_at).toLocaleTimeString('en-US', {
                      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
