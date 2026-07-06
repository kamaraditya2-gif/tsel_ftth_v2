'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Bell, AlertTriangle, AlertCircle, ChevronDown, ChevronUp, RefreshCw, MessageSquare, Send, Ticket, Play, Clock, X } from 'lucide-react'
import LocationFilter from '@/components/LocationFilter'

interface AlarmItem { alarm_code?: string; alarm_type: string; category: string; metric_value: number; threshold_value: number; severity: string; unit: string }
interface DeviceAlarm {
  device_id: number; device_name: string; serial_number: string; brand: string; ont_type: string
  speed_name: string; speed_limit: number; latency: number; packet_loss: number
  download: number; upload: number; alarms: AlarmItem[]; max_severity: string
  root_cause: { id: number; note: string; action: string; pic: string; assigned_at: string } | null; ticket: { id: number; number: string; status: string } | null
}
interface Comment { id: number; device_id: number; parent_id: number | null; comment: string; created_by: string; created_at: string }

function AlarmsV2Page() {
  const searchParams = useSearchParams()
  const [data, setData] = useState<DeviceAlarm[]>([]); const [cleared, setCleared] = useState<DeviceAlarm[]>([])
  const [total, setTotal] = useState(0); const [totalCleared, setTotalCleared] = useState(0)
  const [loading, setLoading] = useState(true); const [expandedId, setExpandedId] = useState<number | null>(null)
  const [filters, setFilters] = useState({}); const [tab, setTab] = useState('active')
  const [locFilters, setLocFilters] = useState({ areaId: null as number | null, regionalId: null as number | null, nopId: null as number | null, areaIds: '', regionalIds: '', nopIds: '' })
  const filtersRef = useRef(filters); const locRef = useRef(locFilters)
  filtersRef.current = filters; locRef.current = locFilters
  const [rootCauses, setRootCauses] = useState<any[]>([])
  const [comments, setComments] = useState<Comment[]>([]); const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<number | null>(null); const [replyText, setReplyText] = useState('')
  const [ticketPanel, setTicketPanel] = useState<any>(null)
  const [ticketSummary, setTicketSummary] = useState('');   const [ticketRCA, setTicketRCA] = useState('')
  const [selectedRc, setSelectedRc] = useState<number | null>(null); const [rcNote, setRcNote] = useState('')
  const [selectedL1, setSelectedL1] = useState(''); const [rcAction, setRcAction] = useState(''); const [rcPIC, setRcPIC] = useState('')
  const [savedRc, setSavedRc] = useState<{ l1: string; name: string; note: string; action: string; pic: string; time: string } | null>(null)
  const [retesting, setRetesting] = useState(false)
  const [historyDevice, setHistoryDevice] = useState<any>(null)
  const [historyData, setHistoryData] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [filterSeverity, setFilterSeverity] = useState('')
  const [mttrData, setMttrData] = useState<any>(null)

  const fetchAlarms = async (f = filters, loc = locFilters) => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if ((loc as any).areaIds) p.set('area_ids', (loc as any).areaIds)
      else if (loc.areaId) p.set('area_id', loc.areaId.toString())
      if ((loc as any).regionalIds) p.set('regional_ids', (loc as any).regionalIds)
      else if (loc.regionalId) p.set('regional_id', loc.regionalId.toString())
      if ((loc as any).nopIds) p.set('nop_ids', (loc as any).nopIds)
      else if (loc.nopId) p.set('nop_id', loc.nopId.toString())
      Object.entries(f).forEach(([k, v]) => { if (v) p.set(k, v as string) })
      const res = await fetch(`/api/alarms/check?${p}`); const r = await res.json()
      setData(r.alarms || []); setCleared(r.cleared || []); setTotal(r.total || 0); setTotalCleared(r.total_cleared || 0)
      setRootCauses(r.root_causes || [])
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }
  useEffect(() => {
    const sev = searchParams.get('severity') || ''
    const tb = searchParams.get('tab') || 'active'
    const aIds = searchParams.get('area_ids') || ''
    const rIds = searchParams.get('regional_ids') || ''
    const nIds = searchParams.get('nop_ids') || ''
    if (sev) setFilterSeverity(sev)
    if (tb) setTab(tb)
    const initialFilters: any = {}
    if (sev) initialFilters.severity = sev
    setFilters(initialFilters)
    const nl = {
      areaId: null as number | null, regionalId: null as number | null, nopId: null as number | null,
      areaIds: aIds, regionalIds: rIds, nopIds: nIds
    }
    setLocFilters(nl)
    fetchAlarms(initialFilters, nl)
  }, [])

  const fetchAlarmHistory = async (deviceId: number) => {
    setHistoryLoading(true)
    try {
      const res = await fetch(`/api/alarms/history?device_id=${deviceId}`)
      const data = await res.json()
      setHistoryData(data.results || [])
    } catch (e) { console.error(e) }
    finally { setHistoryLoading(false) }
  }

  const handleFilterChange = (f: any) => { setFilters(f); fetchAlarms(f, locFilters) }
  const handleLocationChange = (loc: { areaIds: number[]; regionalIds: number[]; nopIds: number[] }) => {
    const nl = { areaId: loc.areaIds[0] ?? null, regionalId: loc.regionalIds[0] ?? null, nopId: loc.nopIds[0] ?? null, areaIds: loc.areaIds.join(','), regionalIds: loc.regionalIds.join(','), nopIds: loc.nopIds.join(',') }
    setLocFilters(nl)
    fetchAlarms(filters, nl)
  }

  const list = tab === 'active' ? data : cleared

  const loadComments = async (deviceId: number) => {
    const res = await fetch(`/api/alarms/comments?device_id=${deviceId}`); const r = await res.json()
    setComments(r.data || r.comments || [])
  }
  const toggleExpand = (d: DeviceAlarm) => {
    if (expandedId === d.device_id) { setExpandedId(null); return }
    setExpandedId(d.device_id); loadComments(d.device_id)
    const rc = d.root_cause ? rootCauses.find(r => r.id === d.root_cause!.id) : null
    setSelectedL1(rc?.category || '')
    setSelectedRc(d.root_cause?.id || null)
    setRcNote(d.root_cause?.note || '')
    setRcAction((d.root_cause as any)?.action || '')
    setRcPIC((d.root_cause as any)?.pic || '')
  }

  const addComment = async () => {
    if (!newComment.trim() || !expandedId) return
    await fetch('/api/alarms/comments', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ device_id: expandedId, comment: newComment }) })
    setNewComment(''); loadComments(expandedId)
  }
  const addReply = async (parentId: number) => {
    if (!replyText.trim() || !expandedId) return
    await fetch('/api/alarms/comments', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ device_id: expandedId, comment: replyText, parent_id: parentId }) })
    setReplyText(''); setReplyingTo(null); loadComments(expandedId)
  }
  const assignRootCause = async () => {
    if (!expandedId || !selectedRc) return
    const rc = rootCauses.find(r => r.id === selectedRc)
    const resp = await fetch('/api/alarms/root-cause/assign', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ device_id: expandedId, root_cause_id: selectedRc, note: rcNote, action: rcAction, pic: rcPIC }) })
    if (resp.ok) {
      const now = new Date().toISOString()
      const upd = (arr: DeviceAlarm[]) => arr.map(dd => dd.device_id === expandedId ? { ...dd, root_cause: { id: selectedRc!, note: rcNote, action: rcAction, pic: rcPIC, assigned_at: now } as any } : dd)
      setData(prev => upd(prev))
      setCleared(prev => upd(prev))
    }
    fetchAlarms()
  }
  const createTicket = async () => {
    if (!ticketPanel || !ticketSummary.trim()) return
    await fetch('/api/alarms/tickets', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ device_id: ticketPanel.device_id, summary: ticketSummary, root_cause: ticketRCA }) })
    setTicketPanel(null); setTicketSummary(''); setTicketRCA(''); fetchAlarms()
  }

  const severityColor = (s: string) => s === 'critical' ? 'text-red-400 bg-red-500/10 border-red-500/30' : s === 'warning' ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' : 'text-green-400 bg-green-500/10 border-green-500/30'

  const rootCauseName = (id: number) => rootCauses.find(r => r.id === id)?.name || 'Unknown'

  const runRetest = async () => {
    if (!expandedId) return; setRetesting(true)
    try {
      const device = list.find(d => d.device_id === expandedId)
      const title = `Retest ${device?.serial_number || expandedId}`
      const createRes = await fetch('/api/tasks', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ title, task_type: 'ondemand', device_id: expandedId, test_type: 'ping,download,upload' })
      })
      if (createRes.ok) {
        const task = await createRes.json()
        await fetch(`/api/tasks/${task.id}/run`, { method: 'POST' })
        alert('Retest submitted! Check queueing page.')
      }
    } catch (e) { console.error(e) }
    finally { setRetesting(false) }
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/20"><Bell className="w-5 h-5 text-white" /></div>
            <div><h1 className="text-xl font-bold text-white">Alarm Management</h1><p className="text-xs text-gray-400">{total} violations, {totalCleared} cleared</p></div>
          </div>
          <button onClick={() => fetchAlarms()} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700 text-white text-sm hover:bg-slate-600"><RefreshCw className="w-4 h-4" /> Refresh</button>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-slate-800/50 backdrop-blur-md p-4 rounded-2xl border border-slate-700/50 relative z-50">
          <LocationFilter onFilterChange={handleLocationChange} />
          <select value={filterSeverity} onChange={e => { setFilterSeverity(e.target.value); handleFilterChange({ ...filters, severity: e.target.value }) }}
            className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-xs">
            <option value="">All Severity</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
          </select>
          <input
            type="text"
            placeholder="Search device..."
            value={(filters as any).search || ''}
            onChange={e => handleFilterChange({ ...filters, search: e.target.value })}
            className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-xs flex-1 min-w-[140px]"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button onClick={() => setTab('active')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${tab === 'active' ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-slate-800/50 text-gray-400 border border-slate-700/50 hover:bg-slate-700/50'}`}><AlertCircle className="w-4 h-4" /> Active ({total})</button>
          <button onClick={() => { setTab('cleared'); fetch('/api/alarms/mttr').then(r => r.json()).then(d => setMttrData(d)).catch(() => {}) }} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${tab === 'cleared' ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-slate-800/50 text-gray-400 border border-slate-700/50 hover:bg-slate-700/50'}`}><AlertTriangle className="w-4 h-4" /> Cleared ({totalCleared})</button>
          {ticketPanel && <button onClick={() => setTicketPanel(null)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/30 text-sm"><X className="w-4 h-4" /> Close Ticket</button>}
        </div>

        {/* MTTR Summary (cleared tab only) */}
        {tab === 'cleared' && mttrData && (
          <div className="p-4 rounded-2xl border border-green-500/20 bg-green-500/5 backdrop-blur-md">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <span className="text-gray-400">Resolved (30d): <strong className="text-green-300">{mttrData.total_resolved}</strong></span>
              <span className="text-gray-400">MTTR: <strong className="text-green-300">{mttrData.avg_duration_seconds ? (() => { let s = mttrData.avg_duration_seconds; const d = Math.floor(s / 86400); s %= 86400; const h = Math.floor(s / 3600); s %= 3600; const m = Math.floor(s / 60); s %= 60; return `${d ? d + 'd ' : ''}${h}h ${m}m`; })() : '-'}</strong></span>
              <span className="text-gray-400">Min: <strong className="text-green-300">{mttrData.min_duration_seconds ? (() => { let s = mttrData.min_duration_seconds; const d = Math.floor(s / 86400); s %= 86400; const h = Math.floor(s / 3600); s %= 3600; const m = Math.floor(s / 60); s %= 60; return `${d ? d + 'd ' : ''}${h}h ${m}m`; })() : '-'}</strong></span>
              <span className="text-gray-400">Max: <strong className="text-green-300">{mttrData.max_duration_seconds ? (() => { let s = mttrData.max_duration_seconds; const d = Math.floor(s / 86400); s %= 86400; const h = Math.floor(s / 3600); s %= 3600; const m = Math.floor(s / 60); s %= 60; return `${d ? d + 'd ' : ''}${h}h ${m}m`; })() : '-'}</strong></span>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/80">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Alarm ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Device</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Brand/Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Latency</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Packet Loss</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Download</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Upload</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Speed Pkg</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Severity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase">Hist</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {loading ? <tr><td colSpan={13} className="px-4 py-10 text-center text-gray-400">Checking alarms...</td></tr>
                : list.length === 0 ? <tr><td colSpan={13} className="px-4 py-10 text-center text-gray-400">{tab === 'active' ? 'No threshold violations' : 'No cleared devices'}</td></tr>
                : list.map((d: DeviceAlarm) => (
                  <><tr key={d.device_id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3"><span className="text-[11px] font-mono text-gray-400 font-semibold tracking-wider">{d.alarms[0]?.alarm_code || '-'}</span></td>
                    <td className="px-4 py-3"><p className="text-sm text-white">{d.device_name}</p><p className="text-xs text-gray-400">{d.serial_number}</p></td>
                    <td className="px-4 py-3"><p className="text-sm text-white">{d.brand || '-'}</p><p className="text-xs text-gray-400">{d.ont_type || ''}</p></td>
                    <td className="px-4 py-3"><span className="text-xs text-gray-400">{new Date().toLocaleTimeString('id-ID', {hour:'2-digit',minute:'2-digit'})} {new Date().toLocaleDateString('id-ID', {day:'2-digit',month:'short'})}</span></td>
                    <td className="px-4 py-3">{d.latency != null ? <span className={`text-sm font-mono ${d.latency > 100 ? 'text-red-400' : d.latency > 50 ? 'text-amber-400' : 'text-green-400'}`}>{Number(d.latency).toFixed(2)} ms</span> : <span className="text-xs text-gray-500">—</span>}</td>
                    <td className="px-4 py-3">{d.packet_loss != null ? <span className={`text-sm font-mono ${d.packet_loss > 5 ? 'text-red-400' : d.packet_loss > 2 ? 'text-amber-400' : 'text-green-400'}`}>{Number(d.packet_loss).toFixed(2)}%</span> : <span className="text-xs text-gray-500">—</span>}</td>
                    <td className="px-4 py-3">{d.download != null ? <span className="text-sm font-mono text-white">{Number(d.download).toFixed(2)} Mbps</span> : <span className="text-xs text-gray-500">—</span>}</td>
                    <td className="px-4 py-3">{d.upload != null ? <span className="text-sm font-mono text-white">{Number(d.upload).toFixed(2)} Mbps</span> : <span className="text-xs text-gray-500">—</span>}</td>
                    <td className="px-4 py-3"><span className="text-sm text-gray-300">{d.speed_name || '-'} {d.speed_limit ? '(' + d.speed_limit + ' Mbps)' : ''}</span></td>
                    <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${severityColor(d.max_severity)}`}>{d.max_severity === 'critical' ? <AlertCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}{d.max_severity}</span></td>
                    <td className="px-4 py-3">{d.ticket ? <span className="text-xs text-blue-400">{d.ticket.number}</span> : <span className="text-xs text-gray-500">—</span>}</td>
                    <td className="px-4 py-3 text-center"><button onClick={() => { setHistoryDevice(d); fetchAlarmHistory(d.device_id) }} className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700 hover:bg-slate-600 text-gray-300 transition-colors">View</button></td>
                    <td className="px-4 py-3"><button onClick={() => toggleExpand(d)} className="p-1 rounded-lg hover:bg-slate-600 text-gray-400">{expandedId === d.device_id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button></td>
                  </tr>
                  {expandedId === d.device_id && <tr key={`${d.device_id}-detail`}><td colSpan={13} className="px-6 py-4 bg-slate-800/30">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Left: Root Cause + Retest */}
                      <div className="space-y-3">
                        <div><p className="text-xs text-gray-400 font-semibold uppercase mb-2">Root Cause</p>
                          {/* L1 Category */}
                          <select value={selectedL1} onChange={e => { setSelectedL1(e.target.value); setSelectedRc(null) }} className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white mb-2">
                            <option value="">Select L1</option>
                            {rootCauses.reduce<string[]>((acc, rc) => acc.includes(rc.category) ? acc : [...acc, rc.category], []).map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                          {/* L2 Root Cause */}
                          {selectedL1 && (
                            <select value={selectedRc || ''} onChange={e => setSelectedRc(e.target.value ? parseInt(e.target.value) : null)} className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white mb-2">
                              <option value="">Select L2</option>
                              {rootCauses.filter(rc => rc.category === selectedL1).map(rc => (
                                <option key={rc.id} value={rc.id}>{rc.name}</option>
                              ))}
                            </select>
                          )}
                          {/* Note for Other */}
                          {selectedL1 === 'Other' && (
                            <input type="text" value={rcNote} onChange={e => setRcNote(e.target.value)} placeholder="Specify other cause..." className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white mb-2" />
                          )}
                          <button onClick={assignRootCause} disabled={!selectedRc} className="w-full py-1.5 rounded bg-blue-500/20 text-blue-300 text-sm hover:bg-blue-500/30 disabled:opacity-40">Save Root Cause</button>
                          {(() => {
                            const expandedDevice = list.find(dd => dd.device_id === expandedId)
                            const rcInfo = expandedDevice?.root_cause ? rootCauses.find(rr => rr.id === expandedDevice.root_cause!.id) : null
                            if (!expandedDevice?.root_cause && !rcInfo) return null
                            const rc = expandedDevice!.root_cause!
                            return (
                              <div className="mt-2 p-2 rounded bg-slate-700/50 border border-slate-600 text-[10px] text-gray-300 space-y-0.5">
                                {rcInfo?.category && <p><span className="text-gray-500">L1:</span> {rcInfo.category}</p>}
                                {rcInfo?.name && <p><span className="text-gray-500">L2:</span> {rcInfo.name}</p>}
                                {rc.note && <p><span className="text-gray-500">Note:</span> {rc.note}</p>}
                                {rc.assigned_at && <p><span className="text-gray-500">Assigned:</span> {new Date(rc.assigned_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</p>}
                              </div>
                            )
                          })()}
                        </div>
                        {/* Action */}
                        <div><p className="text-xs text-gray-400 font-semibold uppercase mb-2">Action</p>
                          <textarea value={rcAction} onChange={e => setRcAction(e.target.value)} rows={2} placeholder="Describe action taken..." className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white" />
                          {(() => {
                            const ed = list.find(dd => dd.device_id === expandedId)
                            const rc = ed?.root_cause
                            if (!rc?.action) return null
                            return <div className="mt-1 p-1.5 rounded bg-slate-700/30 text-[10px] text-gray-300"><span className="text-gray-500">Saved:</span> {rc.action}{rc.assigned_at ? <span className="text-gray-500 ml-2">at {new Date(rc.assigned_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</span> : ''}</div>
                          })()}
                        </div>
                        {/* PIC */}
                        <div><p className="text-xs text-gray-400 font-semibold uppercase mb-2">PIC</p>
                          <input type="text" value={rcPIC} onChange={e => setRcPIC(e.target.value)} placeholder="Person in charge..." className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white" />
                          {(() => {
                            const ed = list.find(dd => dd.device_id === expandedId)
                            const rc = ed?.root_cause
                            if (!rc?.pic) return null
                            return <div className="mt-1 p-1.5 rounded bg-slate-700/30 text-[10px] text-gray-300"><span className="text-gray-500">PIC:</span> {rc.pic}{rc.assigned_at ? <span className="text-gray-500 ml-2">at {new Date(rc.assigned_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</span> : ''}</div>
                          })()}
                        </div>
                        <div><button onClick={runRetest} disabled={retesting} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/20 text-indigo-300 text-sm hover:bg-indigo-500/30 disabled:opacity-40"><Play className="w-4 h-4" /> {retesting ? 'Submitting...' : 'Retest On-Demand'}</button></div>
                      </div>
                      {/* Right: Comments */}
                      <div><p className="text-xs text-gray-400 font-semibold uppercase mb-2">Comments</p>
                        <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
                          {comments.filter(c => !c.parent_id).map(c => (
                            <div key={c.id} className="bg-slate-700/30 rounded-lg p-2">
                              <p className="text-sm text-white">{c.comment}</p>
                              <p className="text-[10px] text-gray-500 mt-1">{c.created_by} · {new Date(c.created_at).toLocaleString('id-ID')}</p>
                              <button onClick={() => setReplyingTo(replyingTo === c.id ? null : c.id)} className="text-[10px] text-blue-400 mt-1 hover:underline">Reply</button>
                              {replyingTo === c.id && <div className="flex gap-1 mt-1"><input type="text" value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Write reply..." className="flex-1 px-2 py-1 bg-slate-600 rounded text-xs text-white" onKeyDown={e => { if (e.key === 'Enter') addReply(c.id) }} /><button onClick={() => addReply(c.id)} className="px-2 py-1 rounded bg-blue-500/20 text-blue-300 text-xs"><Send className="w-3 h-3" /></button></div>}
                              {comments.filter(r => r.parent_id === c.id).map(r => (
                                <div key={r.id} className="ml-4 mt-1 pl-2 border-l border-slate-600 bg-slate-700/20 rounded p-1.5">
                                  <p className="text-xs text-gray-300">{r.comment}</p>
                                  <p className="text-[10px] text-gray-500">{r.created_by} · {new Date(r.created_at).toLocaleString('id-ID')}</p>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Add comment..." className="flex-1 px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white" onKeyDown={e => { if (e.key === 'Enter') addComment() }} />
                          <button onClick={addComment} className="px-3 py-1.5 rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/30"><Send className="w-4 h-4" /></button>
                        </div>
                      </div>
                    </div>
                    {/* Create Ticket */}
                    <div className="mt-4 pt-3 border-t border-slate-700">
                      <button onClick={() => { setTicketPanel(d); setTicketSummary(''); setTicketRCA('') }} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/20 text-green-300 text-sm hover:bg-green-500/30"><Ticket className="w-4 h-4" /> Create Ticket</button>
                    </div>
                  </td></tr>}</>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-slate-700 text-xs text-gray-500">{list.length} devices</div>
        </div>
      </div>

      {/* Ticket Panel (slide-in) */}
      {ticketPanel && <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setTicketPanel(null)}>
        <div className="w-full max-w-lg bg-slate-900 h-full overflow-y-auto p-6 shadow-2xl border-l border-slate-700" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-white">Create Ticket</h2>
            <button onClick={() => setTicketPanel(null)} className="p-1 rounded hover:bg-slate-700 text-gray-400"><X className="w-5 h-5" /></button>
          </div>
          <div className="space-y-4">
            <div><p className="text-xs text-gray-400 mb-1">Device</p><p className="text-sm text-white">{ticketPanel.device_name} ({ticketPanel.serial_number})</p></div>
            <div><p className="text-xs text-gray-400 mb-1">Violations</p>
              <div className="space-y-1">{ticketPanel.alarms.map((a: AlarmItem, i: number) => <div key={i} className="flex items-center gap-2 text-sm"><span className={`w-2 h-2 rounded-full ${a.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'}`} /><span className="text-gray-300">{a.alarm_type.replace(/_/g, ' ')}: {a.metric_value}{a.unit}</span><span className="text-[9px] text-gray-500 font-mono">{a.alarm_code || ''}</span></div>)}</div>
            </div>
            <div><label className="text-xs text-gray-400 mb-1 block">Root Cause Analysis</label><textarea value={ticketRCA} onChange={e => setTicketRCA(e.target.value)} rows={3} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-white" placeholder="Describe root cause..." /></div>
            <div><label className="text-xs text-gray-400 mb-1 block">Summary</label><textarea value={ticketSummary} onChange={e => setTicketSummary(e.target.value)} rows={3} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-white" placeholder="Ticket summary..." /></div>
            <button onClick={createTicket} disabled={!ticketSummary.trim()} className="w-full py-2 rounded-lg bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30 disabled:opacity-40 text-sm font-medium">Submit Ticket</button>
          </div>
        </div>
      </div>}

      {/* History Modal */}
      {historyDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setHistoryDevice(null)}>
          <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6 max-w-3xl w-full mx-4 max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Alarm History — {historyDevice.device_name}</h3>
              <button onClick={() => setHistoryDevice(null)} className="p-1 rounded-lg hover:bg-slate-700 text-gray-400"><X className="w-5 h-5" /></button>
            </div>
            {(() => {
              const resolved = historyData.filter((h: any) => h.source === 'history')
              const mttr = resolved.length > 0
                ? resolved.reduce((s: number, h: any) => s + (h.duration_seconds || 0), 0) / resolved.length
                : 0
              const fmtDur = (sec: number) => {
                if (!sec || sec <= 0) return '-'
                const d = Math.floor(sec / 86400); sec %= 86400
                const hh = Math.floor(sec / 3600); sec %= 3600
                const mm = Math.floor(sec / 60); sec %= 60
                const parts: string[] = []
                if (d > 0) parts.push(`${d}d`)
                if (hh > 0) parts.push(`${hh}h`)
                if (mm > 0) parts.push(`${mm}m`)
                if (parts.length === 0) parts.push(`${sec}s`)
                return parts.join(' ')
              }
              return resolved.length > 0 ? (
                <div className="mb-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700 text-xs text-gray-300">
                  Resolved: {resolved.length} alarms &middot; MTTR: {fmtDur(Math.round(mttr))}
                </div>
              ) : null
            })()}
            <div className="flex-1 overflow-y-auto">
              {historyLoading ? (
                <div className="text-center py-8 text-gray-400">Loading...</div>
              ) : historyData.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No alarm history for this device</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase">Time</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase">Alarm Type</th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-400 uppercase">Value</th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-400 uppercase">Threshold</th>
                      <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-400 uppercase">Severity</th>
                      <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-400 uppercase">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {historyData.map((h: any, i: number) => {
                      const sec = h.duration_seconds || 0
                      const d = Math.floor(sec / 86400); let s = sec % 86400
                      const hh = Math.floor(s / 3600); s %= 3600
                      const mm = Math.floor(s / 60); s %= 60
                      const parts: string[] = []
                      if (d > 0) parts.push(`${d}d`)
                      if (hh > 0) parts.push(`${hh}h`)
                      if (mm > 0) parts.push(`${mm}m`)
                      if (parts.length === 0 && s > 0) parts.push(`${s}s`)
                      const durStr = parts.length > 0 ? parts.join(' ') : (h.source === 'active' ? 'counting...' : '-')
                      return (
                        <tr key={i} className="hover:bg-slate-800/50 text-xs">
                          <td className="px-3 py-2 text-gray-400">{h.triggered_at ? new Date(h.triggered_at).toLocaleString('id-ID') : '-'}</td>
                          <td className="px-3 py-2 text-gray-200">{h.alarm_type?.replace(/_/g, ' ')}</td>
                          <td className="px-3 py-2 text-right font-mono text-gray-200">{h.metric_value}{h.unit}</td>
                          <td className="px-3 py-2 text-right font-mono text-gray-500">{h.threshold_value}{h.unit}</td>
                          <td className="px-3 py-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[10px] ${h.severity === 'critical' ? 'bg-red-500/10 text-red-300' : 'bg-amber-500/10 text-amber-300'}`}>{h.severity}</span></td>
                          <td className="px-3 py-2 text-center font-mono text-gray-300">{durStr}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AlarmsV2PageWrapper() {
  return <Suspense fallback={<div className="p-8 text-gray-400">Loading...</div>}><AlarmsV2Page /></Suspense>
}