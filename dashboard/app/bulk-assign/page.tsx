'use client'

import { useEffect, useState } from 'react'
import { MapPin, Upload, Check, AlertCircle, Users, Search } from 'lucide-react'

interface Region { id: number; name: string; province: string; status: string }
interface Device { id: number; device_name: string; serial_number: string; ip_address: string; manufacturer: string; model: string; group_name: string; downstream_server_id: number | null; region_name: string | null }

export default function BulkAssignPage() {
  const [regions, setRegions] = useState<Region[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [regionId, setRegionId] = useState<number | ''>('')
  const [filter, setFilter] = useState<'all' | 'unassigned' | 'assigned'>('all')
  const [search, setSearch] = useState('')
  const [assignMode, setAssignMode] = useState<'selected' | 'filtered' | 'all'>('selected')
  const [result, setResult] = useState<{ success: boolean; updated: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectAll, setSelectAll] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/downstream-servers').then(r => r.json()),
      fetch('/api/devices').then(r => r.json())
    ]).then(([rData, dData]) => {
      setRegions(rData.servers || [])
      setDevices(dData || [])
      setLoading(false)
    })
  }, [])

  const filteredDevices = devices.filter(d => {
    if (filter === 'unassigned' && d.downstream_server_id !== null) return false
    if (filter === 'assigned' && d.downstream_server_id === null) return false
    if (search) {
      const s = search.toLowerCase()
      if (!d.serial_number?.toLowerCase().includes(s) && !d.device_name?.toLowerCase().includes(s) && !d.ip_address?.toLowerCase().includes(s) && !d.manufacturer?.toLowerCase().includes(s))
        return false
    }
    return true
  })

  const handleSelectAll = () => {
    if (selectAll) { setSelectedIds([]); setSelectAll(false) }
    else { setSelectedIds(filteredDevices.map(d => d.id)); setSelectAll(true) }
  }

  const toggleDevice = (id: number) => {
    setSelectedIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
    setSelectAll(false)
  }

  const handleAssign = async () => {
    if (!regionId) return
    setSaving(true)
    setResult(null)

    let body: any = { region_id: regionId }
    if (assignMode === 'selected') body.device_ids = selectedIds
    else if (assignMode === 'filtered') body.device_ids = filteredDevices.map(d => d.id)
    else body.assign_all = true

    const res = await fetch('/api/devices/bulk-assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const data = await res.json()
    setResult(data)

    // Refresh devices
    const dData = await fetch('/api/devices').then(r => r.json())
    setDevices(dData || [])
    setSelectedIds([])
    setSelectAll(false)
    setSaving(false)
  }

  if (loading) return <div className="min-h-screen p-8 flex items-center justify-center"><div className="text-gray-400">Loading...</div></div>

  const region = regions.find(r => r.id === regionId)

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <MapPin className="w-8 h-8 text-cyan-400" />
          Bulk Assign Devices to Region
        </h1>
        <p className="text-gray-400 mt-1">{devices.length} devices — {regions.length} regions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Region Selection */}
        <div className="lg:col-span-1">
          <div className="bg-white/5 rounded-2xl border border-white/10 p-5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-cyan-400" /> Target Region
            </h2>
            <select value={regionId} onChange={e => setRegionId(Number(e.target.value) || '')}
              className="w-full px-3 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white mb-4 focus:outline-none focus:border-cyan-500">
              <option value="" className="text-gray-300">Pilih region...</option>
              {regions.map(r => (
                <option key={r.id} value={r.id}>{r.name} ({r.province}) — {r.status}</option>
              ))}
            </select>
            {region && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-sm text-emerald-300">
                ✓ Assign to: <strong>{region.name}</strong> ({region.province})
              </div>
            )}

            <hr className="border-white/10 my-4" />
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Bulk Mode</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input type="radio" name="mode" checked={assignMode === 'selected'} onChange={() => setAssignMode('selected')} />
                Selected devices ({selectedIds.length})
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input type="radio" name="mode" checked={assignMode === 'filtered'} onChange={() => setAssignMode('filtered')} />
                Current filter results ({filteredDevices.length})
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input type="radio" name="mode" checked={assignMode === 'all'} onChange={() => setAssignMode('all')} />
                ALL devices ({devices.length})
              </label>
            </div>

            <button onClick={handleAssign} disabled={!regionId || saving}
              className="w-full mt-4 px-4 py-3 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition">
              {saving ? 'Assigning...' : <><Upload className="w-4 h-4" /> Assign to Region</>}
            </button>

            {result && (
              <div className={`mt-4 p-3 rounded-xl flex items-center gap-2 text-sm ${
                result.success ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/10 text-red-300 border border-red-500/30'
              }`}>
                {result.success ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {result.success ? `✓ ${result.updated} devices assigned!` : 'Failed'}
              </div>
            )}
          </div>
        </div>

        {/* Right: Device List */}
        <div className="lg:col-span-2">
          <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
            {/* Filters */}
            <div className="p-4 border-b border-white/10 flex flex-wrap gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search devices..."
                  className="w-full pl-9 pr-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm" />
              </div>
              {['all', 'unassigned', 'assigned'].map(f => (
                <button key={f} onClick={() => { setFilter(f as any); setSelectedIds([]); setSelectAll(false) }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filter === f ? 'bg-cyan-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
              <div className="text-xs text-gray-500 self-center">{filteredDevices.length} devices</div>
            </div>

            {/* Table */}
            <div className="overflow-y-auto max-h-[60vh]">
              <table className="w-full">
                <thead className="bg-white/5 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left"><input type="checkbox" checked={selectAll && filteredDevices.length > 0} onChange={handleSelectAll} /></th>
                    <th className="px-3 py-2 text-left text-xs text-gray-400 font-medium">S/N</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-400 font-medium">Name</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-400 font-medium">IP</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-400 font-medium">Region</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredDevices.map(d => (
                    <tr key={d.id} className={`hover:bg-white/5 text-sm ${selectedIds.includes(d.id) ? 'bg-cyan-500/10' : ''}`}>
                      <td className="px-3 py-2"><input type="checkbox" checked={selectedIds.includes(d.id)} onChange={() => toggleDevice(d.id)} /></td>
                      <td className="px-3 py-2 text-white font-mono text-xs">{d.serial_number}</td>
                      <td className="px-3 py-2 text-gray-300">{d.device_name}</td>
                      <td className="px-3 py-2 text-gray-400 font-mono text-xs">{d.ip_address || '-'}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${d.downstream_server_id ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-500/20 text-gray-400'}`}>
                          {d.region_name || 'Unassigned'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
