'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Search, Clock, Users, Server, ChevronRight, Wifi, WifiOff } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Server {
  id: number; name: string; location: string; province: string; lat: number; lng: number; status: string
}

interface RegionWithStats extends Server {
  device_count: number; recent_pings: number; avg_latency: number; packet_loss: number
  cities: string[]; last_ping_at: string | null
}

export default function RegionalPage() {
  const router = useRouter()
  const [regions, setRegions] = useState<RegionWithStats[]>([])
  const [nopCities, setNopCities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/downstream-servers'),
      fetch('/api/nop-cities'),
      fetch('/api/admin/regional-status')
    ]).then(async ([sRes, nRes, rRes]) => {
      const servers = await sRes.json()
      const nop = await nRes.json()
      const status = await rRes.json()
      const cities = nop.cities || []

      const merged = (servers.servers || []).map((s: any) => {
        const rs = (status.regions || []).find((r: any) => r.id === s.id) || {}
        const regionCities = cities.filter((c: any) => c.region_id === s.id).map((c: any) => c.city)
        return {
          ...s,
          device_count: rs.device_count || 0,
          recent_pings: rs.recent_pings || 0,
          avg_latency: rs.avg_latency || 0,
          packet_loss: rs.packet_loss || 0,
          last_ping_at: rs.last_ping_at || null,
          cities: regionCities
        }
      })

      setRegions(merged)
      setNopCities(cities)
      setLoading(false)
    })
  }, [])

  const filtered = regions.filter(r =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.province.toLowerCase().includes(search.toLowerCase()) ||
    r.location?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return (
    <div className="min-h-screen p-8 flex items-center justify-center">
      <div className="text-gray-400">Loading regions...</div>
    </div>
  )

  return (
    <div className="min-h-screen p-4 md:p-8 bg-transparent">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <MapPin className="w-8 h-8 text-cyan-400" />
          Regional Telkomsel (R01-R12)
        </h1>
        <p className="text-gray-400 mt-1">{regions.length} regions · {regions.reduce((s, r) => s + r.device_count, 0)} ONT assigned</p>
      </div>

      {/* Search & Stats */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search region..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white" />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Regions', value: regions.length, icon: MapPin, color: 'text-cyan-400' },
          { label: 'Total ONT', value: regions.reduce((s, r) => s + r.device_count, 0), icon: Server, color: 'text-blue-400' },
          { label: 'Active Pinging', value: regions.filter(r => r.recent_pings > 0).length, icon: Wifi, color: 'text-emerald-400' },
          { label: 'NOP Cities', value: nopCities.length, icon: Users, color: 'text-purple-400' },
        ].map((card, i) => (
          <div key={i} className="bg-[#0f0f1a]/90 backdrop-blur-md rounded-xl border border-white/10 p-4">
            <card.icon className={`w-5 h-5 ${card.color} mb-2`} />
            <p className="text-xs text-gray-400">{card.label}</p>
            <p className="text-2xl font-bold text-white">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Region Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(region => {
          const isActive = region.recent_pings > 0 || region.device_count > 0
          return (
            <div key={region.id}
              onClick={() => router.push(`/devices?region=${region.id}`)}
              className={`rounded-2xl border p-5 backdrop-blur-md transition-all hover:-translate-y-1 cursor-pointer ${
                isActive ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${isActive ? 'text-emerald-400' : 'text-gray-400'}`}>
                    {region.name}
                  </span>
                  {isActive ? <Wifi className="w-4 h-4 text-emerald-400 animate-pulse" /> : <WifiOff className="w-4 h-4 text-gray-600" />}
                </div>
                <ChevronRight className="w-5 h-5 text-gray-500" />
              </div>

              <div className="flex items-center gap-4 mb-3 text-sm">
                <div className="flex items-center gap-1 text-gray-400">
                  <MapPin className="w-3.5 h-3.5" />
                  {region.location || region.province}
                </div>
                <div className="flex items-center gap-1 text-gray-400">
                  <Server className="w-3.5 h-3.5" />
                  {region.device_count} ONT
                </div>
              </div>

              {/* Cities */}
              {region.cities.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {region.cities.slice(0, 4).map(city => (
                    <span key={city} className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] text-gray-400">
                      {city.substring(0, 12)}
                    </span>
                  ))}
                  {region.cities.length > 4 && (
                    <span className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] text-gray-500">
                      +{region.cities.length - 4}
                    </span>
                  )}
                </div>
              )}

              {/* Stats bar */}
              <div className="flex justify-between text-xs text-gray-500 pt-3 border-t border-white/5">
                <span>ID: {region.id}</span>
                {region.last_ping_at && (
                  <span>
                    <Clock className="w-3 h-3 inline mr-1" />
                    {new Date(region.last_ping_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Empty */}
      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <MapPin className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p>No regions found</p>
        </div>
      )}
    </div>
  )
}
