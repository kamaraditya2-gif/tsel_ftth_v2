'use client'

import { useEffect, useState } from 'react'
import { Plus, Edit, Trash2, Search, Filter, Clock, MapPin, Building2 } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface ScheduledTask {
  id: number; title: string; test_type: string; cron_time: string; started_at: string
  is_active: boolean; group_id: number | null; device_id: number | null; next_run: string
  created_at: string; group_name?: string; device_count?: number; nop_city?: string
}

const CRON_PRESETS = [
  { label: '15 Minutes', cron: '*/15 * * * *' },
  { label: '30 Minutes', cron: '*/30 * * * *' },
  { label: '1 Hour',     cron: '0 * * * *' },
  { label: '3 Hours',    cron: '0 */3 * * *' },
  { label: '6 Hours',    cron: '0 */6 * * *' },
  { label: '12 Hours',   cron: '0 */12 * * *' },
  { label: '24 Hours',   cron: '0 0 * * *' },
  { label: '3 Days',     cron: '0 0 */3 * *' },
  { label: '7 Days',     cron: '0 0 * * 0' },
]

export default function ScheduledPage() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<ScheduledTask | null>(null)
  const [form, setForm] = useState({ title: '', test_types: ['ping', 'upload', 'download'], cron_preset: '*/15 * * * *', is_active: true, region_id: '' as number | '', nop_city: '', start_date: '', start_time: '' })
  const [downstreamServers, setDownstreamServers] = useState<any[]>([])
  const [nopCities, setNopCities] = useState<any[]>([])

  useEffect(() => {
    fetchTasks()
    fetch('/api/downstream-servers').then(r => r.json()).then(d => setDownstreamServers(d.servers || []))
    fetch('/api/nop-cities').then(r => r.json()).then(d => setNopCities(d.cities || []))
  }, [page, search])

  const fetchTasks = async () => {
    try {
      const res = await fetch(`/api/tasks?task_type=scheduled&page=${page}&limit=10&search=${search}`)
      const data = await res.json()
      setTasks(data.data || data.tasks || [])
      setTotalPages(data.totalPages || 1)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleSave = async () => {
    let targetGroupId = form.region_id ? Number(form.region_id) : null
    if (!targetGroupId) {
      alert('Pilih region untuk target device')
      return
    }
    const body: any = {
      title: form.title,
      task_type: 'scheduled',
      test_type: form.test_types.join(','),
      cron_time: form.cron_preset,
      is_active: form.is_active,
      group_id: targetGroupId,
      device_id: null,
      nop_city: form.nop_city || null,
      started_at: form.start_date ? form.start_date + ':00' : null,
    }

    let res
    if (editing) {
      res = await fetch(`/api/tasks?id=${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    } else {
      res = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert('Gagal menyimpan: ' + (err.error || err.details || res.statusText))
      return
    }
    setShowModal(false)
    setEditing(null)
    fetchTasks()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus scheduled task ini?')) return
    try {
      await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' })
      fetchTasks()
    } catch (err) { console.error(err) }
  }

  const handleToggleActive = async (task: ScheduledTask) => {
    try {
      await fetch(`/api/tasks?id=${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...task, is_active: !task.is_active })
      })
      fetchTasks()
    } catch (err) { console.error(err) }
  }

  const getNextRunStatus = (nextRun: string): { label: string; color: string } => {
    if (!nextRun) return { label: 'No schedule', color: 'text-gray-500' }
    const diff = new Date(nextRun).getTime() - Date.now()
    if (diff < 0) return { label: '⏳ Running', color: 'text-emerald-400' }
    if (diff < 300000) return { label: `🔥 ${Math.round(diff/60000)}m`, color: 'text-amber-400' }
    if (diff < 3600000) return { label: `⏰ ${Math.round(diff/60000)}m`, color: 'text-cyan-400' }
    return { label: `📅 ${Math.round(diff/3600000)}h`, color: 'text-gray-400' }
  }

  const toggleTestType = (type: string) => {
    setForm(f => ({
      ...f,
      test_types: f.test_types.includes(type) ? f.test_types.filter(t => t !== type) : [...f.test_types, type]
    }))
  }

  const filteredCities = form.region_id ? nopCities.filter((c: any) => c.region_id === form.region_id) : nopCities

  const getCronLabel = (cron: string) => CRON_PRESETS.find(p => p.cron === cron)?.label || cron

  return (
    <div className="min-h-screen p-4 md:p-8 bg-transparent">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Clock className="w-8 h-8 text-cyan-400" />
            Scheduled Tasks
          </h1>
          <p className="text-gray-400 mt-1">Schedule recurring ping/speed tests</p>
        </div>
        <button onClick={() => { setEditing(null); setForm({ title: '', test_types: ['ping', 'upload', 'download'], cron_preset: '*/15 * * * *', is_active: true, region_id: '', nop_city: '', start_date: '', start_time: '' }); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition">
          <Plus className="w-4 h-4" /> Add Schedule
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks..."
            className="w-full pl-9 pr-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm" />
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Filter className="w-3 h-3" /> {tasks.length} tasks
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {tasks.map(task => (
          <div key={task.id} className={`rounded-2xl border p-5 backdrop-blur-md ${task.is_active ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/10'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${task.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
                <span className="font-semibold text-white">{task.title}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditing(task); setForm({ title: task.title, test_types: task.test_type.split(','), cron_preset: task.cron_time, is_active: task.is_active, region_id: (task.group_id && task.group_id <= 34 ? task.group_id as any : ''), nop_city: task.nop_city || '', start_date: task.started_at ? (task.started_at.endsWith('Z') ? new Date(task.started_at).toLocaleString('sv-SE').replace(' ', 'T').substring(0, 16) : task.started_at.substring(0, 16)) : '', start_time: '' }); setShowModal(true) }}
                  className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-xs">Edit</button>
                <button onClick={() => handleToggleActive(task)}
                  className={`px-3 py-1 rounded-lg text-xs ${task.is_active ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'}`}>
                  {task.is_active ? 'Pause' : 'Activate'}
                </button>
                <button onClick={() => handleDelete(task.id)}
                  className="px-3 py-1 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 text-xs">Delete</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span className="text-emerald-400 font-medium">{task.group_name || 'All Regions'}</span>
              {task.nop_city && <span className="text-blue-400">{task.nop_city}</span>}
              <span className="text-purple-400 font-semibold">{task.device_count || 1} ONT</span>
              <span className="text-gray-400">{task.test_type.replace(/,/g, ', ')}</span>
              <span className="text-cyan-400">{task.cron_time ? getCronLabel(task.cron_time) : '-'}</span>
              <span className="text-gray-400">Start: {task.started_at ? new Date(task.started_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '-'}</span>
              {task.next_run && (
                <span className={getNextRunStatus(task.next_run).color}>
                  {getNextRunStatus(task.next_run).label}
                </span>
              )}
              <span className="text-gray-400">Next: {task.next_run ? new Date(task.next_run).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '-'} WIB</span>
            </div>
          </div>
        ))}
        {!loading && tasks.length === 0 && <div className="text-center py-12 text-gray-500">No scheduled tasks</div>}
      </div>

      {/* Pagination */}
      {totalPages > 1 && <div className="flex justify-center gap-2 mt-6">
        <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded bg-white/5 text-gray-300 disabled:opacity-50">Prev</button>
        <span className="px-3 py-1 text-gray-400">{page}/{totalPages}</span>
        <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded bg-white/5 text-gray-300 disabled:opacity-50">Next</button>
      </div>}

      {/* Modal */}
      {showModal && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 rounded-2xl border border-gray-700 max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
          <h2 className="text-xl font-bold text-white mb-4">{editing ? 'Edit' : 'New'} Scheduled Task</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Title</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white" />
            </div>

            {/* Test Types */}
            <div>
              <label className="text-xs text-gray-400 block mb-2">Test Types</label>
              <div className="flex flex-wrap gap-2">
                {['ping', 'traceroute', 'download', 'upload', 'ont-status'].map(type => (
                  <button key={type} onClick={() => toggleTestType(type)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      form.test_types.includes(type) ? 'bg-cyan-600 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'
                    }`}>
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Cron Presets */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">Interval</label>
              <select value={form.cron_preset} onChange={e => setForm({ ...form, cron_preset: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white">
                {CRON_PRESETS.map(p => (
                  <option key={p.cron} value={p.cron}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Start Date & Time */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">Start Date & Time</label>
              <input type="datetime-local" value={form.start_date}
                min={new Date().toLocaleString('sv-SE').replace(' ', 'T').substring(0, 16)}
                onChange={e => setForm({ ...form, start_date: e.target.value, start_time: '' })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm" />
            </div>

            {/* Region Filter */}
            <div>
              <label className="text-xs text-gray-400 block mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Filter by Region
              </label>
              <select value={form.region_id} onChange={e => setForm({ ...form, region_id: e.target.value ? Number(e.target.value) as any : '', nop_city: '' })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white">
                <option value="">All Regions</option>
                {downstreamServers.map(s => (
                  <option key={s.id} value={s.id}>{s.name} — {s.province}</option>
                ))}
              </select>
            </div>

            {/* NOP City */}
            <div>
              <label className="text-xs text-gray-400 block mb-1 flex items-center gap-1">
                <Building2 className="w-3 h-3" /> Filter by NOP City
              </label>
              <select value={form.nop_city} onChange={e => setForm({ ...form, nop_city: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white">
                <option value="">All Cities</option>
                {filteredCities.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.city}</option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
              Active
            </label>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg">Cancel</button>
            <button onClick={handleSave} className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg">Save</button>
          </div>
        </div>
      </div>}
    </div>
  )
}
