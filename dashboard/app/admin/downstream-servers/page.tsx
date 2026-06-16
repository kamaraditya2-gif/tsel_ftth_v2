'use client'

import { useEffect, useState } from 'react'
import { MapPin, Plus, Edit, Trash2, Check, X, Server, Wifi, WifiOff } from 'lucide-react'
import { useRequireAdmin } from '@/hooks/useRequireAdmin'

interface Server {
  id: number
  name: string
  location: string
  province: string
  lat: number | null
  lng: number | null
  status: string
  icon: string
  color: string
}

export default function DownstreamServersPage() {
  useRequireAdmin()
  const [servers, setServers] = useState<Server[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Server | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', location: '', province: '', lat: '', lng: '', status: 'inactive' })

  const fetchServers = async () => {
    try {
      const res = await fetch('/api/downstream-servers')
      const data = await res.json()
      setServers(data.servers || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchServers() }, [])

  const handleSave = async () => {
    const body = { ...form, lat: form.lat ? parseFloat(form.lat) : null, lng: form.lng ? parseFloat(form.lng) : null }
    if (adding) {
      await fetch('/api/downstream-servers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    } else if (editing) {
      await fetch('/api/downstream-servers', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, id: editing.id }) })
    }
    setAdding(false); setEditing(null); fetchServers()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus regional ini?')) return
    await fetch(`/api/downstream-servers?id=${id}`, { method: 'DELETE' })
    fetchServers()
  }

  const startEdit = (s: Server) => {
    setEditing(s); setAdding(false)
    setForm({ name: s.name, location: s.location || '', province: s.province || '', lat: s.lat?.toString() || '', lng: s.lng?.toString() || '', status: s.status })
  }

  if (loading) return <div className="min-h-screen p-8 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center"><div className="text-gray-400">Loading...</div></div>

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <MapPin className="w-8 h-8 text-cyan-400" />
            Regional Servers
          </h1>
          <p className="text-gray-400 mt-1">{servers.length} downstream servers</p>
        </div>
        <button onClick={() => { setAdding(true); setEditing(null); setForm({ name: '', location: '', province: '', lat: '', lng: '', status: 'inactive' }) }}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition">
          <Plus className="w-4 h-4" /> Add Region
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {servers.map(s => (
          <div key={s.id} className={`rounded-2xl border p-5 backdrop-blur-md transition-all hover:-translate-y-1 ${
            s.status === 'active' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/10'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Server className={`w-5 h-5 ${s.status === 'active' ? 'text-emerald-400' : 'text-gray-500'}`} />
                <span className="font-semibold text-white">{s.name}</span>
              </div>
              {s.status === 'active' ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4 text-gray-600" />}
            </div>
            <div className="text-sm text-gray-400 mb-1">{s.province}{s.location ? ` — ${s.location}` : ''}</div>
            <div className="text-xs text-gray-500 mb-3">
              ID: {s.id} | {s.lat && s.lng ? `${s.lat}, ${s.lng}` : 'No coords'}
            </div>
            <div className="flex gap-2">
              <button onClick={() => startEdit(s)} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-xs flex items-center gap-1"><Edit className="w-3 h-3" /> Edit</button>
              <button onClick={() => handleDelete(s.id)} className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs flex items-center gap-1"><Trash2 className="w-3 h-3" /> Delete</button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Add/Edit */}
      {(adding || editing) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-white mb-4">{adding ? 'Add Region' : 'Edit Region'}</h2>
            <div className="space-y-3">
              <div><label className="text-xs text-gray-400 block mb-1">Name</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white" /></div>
              <div><label className="text-xs text-gray-400 block mb-1">Province</label>
                <input value={form.province} onChange={e => setForm({ ...form, province: e.target.value })}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white" /></div>
              <div><label className="text-xs text-gray-400 block mb-1">Location</label>
                <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-400 block mb-1">Latitude</label>
                  <input value={form.lat} onChange={e => setForm({ ...form, lat: e.target.value })}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white" /></div>
                <div><label className="text-xs text-gray-400 block mb-1">Longitude</label>
                  <input value={form.lng} onChange={e => setForm({ ...form, lng: e.target.value })}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white" /></div>
              </div>
              <div><label className="text-xs text-gray-400 block mb-1">Status</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setAdding(false); setEditing(null) }}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg">Cancel</button>
              <button onClick={handleSave}
                className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg flex items-center justify-center gap-2">
                <Check className="w-4 h-4" /> Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
