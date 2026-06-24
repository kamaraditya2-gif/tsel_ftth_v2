'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, AlertTriangle, AlertCircle, ChevronDown, ChevronUp, RefreshCw, MessageSquare, Send, Ticket, Play, Clock, X } from 'lucide-react'
import GlobalFilter from '@/components/GlobalFilter'

interface AlarmItem { alarm_type: string; category: string; metric_value: number; threshold_value: number; severity: string; unit: string }
interface DeviceAlarm {
  device_id: number; device_name: string; serial_number: string; brand: string; ont_type: string
  speed_name: string; speed_limit: number; latency: number; packet_loss: number
  download: number; upload: number; alarms: AlarmItem[]; max_severity: string
  root_cause: { id: number; note: string } | null; ticket: { id: number; number: string; status: string } | null
}
interface Comment { id: number; device_id: number; parent_id: number | null; comment: string; created_by: string; created_at: string }

export default function AlarmsV2Page() {
  const [data, setData] = useState<DeviceAlarm[]>([]); const [cleared, setCleared] = useState<DeviceAlarm[]>([])
  const [total, setTotal] = useState(0); const [totalCleared, setTotalCleared] = useState(0)
  const [loading, setLoading] = useState(true); const [expandedId, setExpandedId] = useState<number | null>(null)
  const [filters, setFilters] = useState({}); const [tab, setTab] = useState('active')
  const [rootCauses, setRootCauses] = useState<any[]>([])
  const [comments, setComments] = useState<Comment[]>([]); const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<number | null>(null); const [replyText, setReplyText] = useState('')
  const [ticketPanel, setTicketPanel] = useState<any>(null)
  const [ticketSummary, setTicketSummary] = useState('');   const [ticketRCA, setTicketRCA] = useState('')
  const [selectedRc, setSelectedRc] = useState<number | null>(null); const [rcNote, setRcNote] = useState('')
  const [retesting, setRetesting] = useState(false)

  const fetchAlarms = async (f = filters) => {
    setLoading(true)
    try {
      const p = new URLSearchParams(); Object.entries(f).forEach(([k, v]) => { if (v) p.set(k, v as string) })
      const res = await fetch(`/api/alarms/check?${p}`); const r = await res.json()
      setData(r.alarms || []); setCleared(r.cleared || []); setTotal(r.total || 0); setTotalCleared(r.total_cleared || 0)
      setRootCauses(r.root_causes || [])
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }
  useEffect(() => { fetchAlarms() }, [])

  const handleFilterChange = (f: any) => { setFilters(f); fetchAlarms(f) }

  const list = tab === 'active' ? data : cleared

  const loadComments = async (deviceId: number) => {
    const res = await fetch(`/api/alarms/comments?device_id=${deviceId}`); const r = await res.json()
    setComments(r.data || r.comments || [])
  }
  const toggleExpand = (d: DeviceAlarm) => {
    if (expandedId === d.device_id) { setExpandedId(null); return }
    setExpandedId(d.device_id); loadComments(d.device_id)
    setSelectedRc(d.root_cause?.id || null); setRcNote(d.root_cause?.note || '')
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
    await fetch('/api/alarms/root-cause/assign', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ device_id: expandedId, root_cause_id: selectedRc, note: rcNote }) })
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
      const res = await fetch('/api/tasks', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ title: `Retest ${expandedId}`, task_type: 'ondemand', device_id: expandedId, test_types: ['ping','download','upload'] })
      })
      if (res.ok) alert('Retest submitted - check queueing page')
    } catch (e) { console.error(e) }
    finally { setRetesting(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/20"><Bell className="w-5 h-5 text-white" /></div>
            <div><h1 className="text-xl font-bold text-white">Alarm Management</h1><p className="text-xs text-gray-400">{total} violations, {totalCleared} cleared</p></div>
          </div>
          <button onClick={() => fetchAlarms()} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700 text-white text-sm hover:bg-slate-600"><RefreshCw className="w-4 h-4" /> Refresh</button>
        </div>

        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-md p-4"><GlobalFilter onFilterChange={handleFilterChange} /></div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button onClick={() => setTab('active')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${tab === 'active' ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-slate-800/50 text-gray-400 border border-slate-700/50 hover:bg-slate-700/50'}`}><AlertCircle className="w-4 h-4" /> Active ({total})</button>
          <button onClick={() => setTab('cleared')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${tab === 'cleared' ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-slate-800/50 text-gray-400 border border-slate-700/50 hover:bg-slate-700/50'}`}><AlertTriangle className="w-4 h-4" /> Cleared ({totalCleared})</button>
          {ticketPanel && <button onClick={() => setTicketPanel(null)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/30 text-sm"><X className="w-4 h-4" /> Close Ticket</button>}
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/80">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Device</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Brand/Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Latency</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Packet Loss</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Download</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Upload</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Speed Pkg</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Severity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Root Cause</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {loading ? <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400">Checking alarms...</td></tr>
                : list.length === 0 ? <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400">{tab === 'active' ? 'No threshold violations' : 'No cleared devices'}</td></tr>
                : list.map((d: DeviceAlarm) => (
                  <><tr key={d.device_id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3"><p className="text-sm text-white">{d.device_name}</p><p className="text-xs text-gray-400">{d.serial_number}</p></td>
                    <td className="px-4 py-3"><p className="text-sm text-white">{d.brand || '-'}</p><p className="text-xs text-gray-400">{d.ont_type || ''}</p></td>
                    <td className="px-4 py-3">{d.latency != null ? <span className={`text-sm font-mono ${d.latency > 100 ? 'text-red-400' : d.latency > 50 ? 'text-amber-400' : 'text-green-400'}`}>{d.latency} ms</span> : <span className="text-xs text-gray-500">—</span>}</td>
                    <td className="px-4 py-3">{d.packet_loss != null ? <span className={`text-sm font-mono ${d.packet_loss > 5 ? 'text-red-400' : d.packet_loss > 2 ? 'text-amber-400' : 'text-green-400'}`}>{d.packet_loss}%</span> : <span className="text-xs text-gray-500">—</span>}</td>
                    <td className="px-4 py-3">{d.download != null ? <span className="text-sm font-mono text-white">{d.download} Mbps</span> : <span className="text-xs text-gray-500">—</span>}</td>
                    <td className="px-4 py-3">{d.upload != null ? <span className="text-sm font-mono text-white">{d.upload} Mbps</span> : <span className="text-xs text-gray-500">—</span>}</td>
                    <td className="px-4 py-3"><span className="text-sm text-gray-300">{d.speed_name || '-'} {d.speed_limit ? `(${d.speed_limit} Mbps)` : ''}</span></td>
                    <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${severityColor(d.max_severity)}`}>{d.max_severity === 'critical' ? <AlertCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}{d.max_severity}</span></td>
                    <td className="px-4 py-3"><span className="text-xs text-gray-300">{d.root_cause ? rootCauseName(d.root_cause.id) : '-'}</span></td>
                    <td className="px-4 py-3">{d.ticket ? <span className="text-xs text-blue-400">{d.ticket.number}</span> : <span className="text-xs text-gray-500">—</span>}</td>
                    <td className="px-4 py-3"><button onClick={() => toggleExpand(d)} className="p-1 rounded-lg hover:bg-slate-600 text-gray-400">{expandedId === d.device_id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button></td>
                  </tr>
                  {expandedId === d.device_id && <tr key={`${d.device_id}-detail`}><td colSpan={11} className="px-6 py-4 bg-slate-800/30">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Left: Root Cause + Retest */}
                      <div className="space-y-4">
                        <div><p className="text-xs text-gray-400 font-semibold uppercase mb-2">Root Cause</p>
                          <div className="flex gap-2">
                            <select value={selectedRc || ''} onChange={e => setSelectedRc(e.target.value ? parseInt(e.target.value) : null)} className="flex-1 px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white">
                              <option value="">Select root cause</option>
                              {rootCauses.map(rc => <option key={rc.id} value={rc.id}>{rc.name} ({rc.category})</option>)}
                            </select>
                            <button onClick={assignRootCause} className="px-3 py-1.5 rounded bg-blue-500/20 text-blue-300 text-sm hover:bg-blue-500/30">Save</button>
                          </div>
                          <input type="text" value={rcNote} onChange={e => setRcNote(e.target.value)} placeholder="Note..." className="w-full mt-2 px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white" />
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
              <div className="space-y-1">{ticketPanel.alarms.map((a: AlarmItem, i: number) => <div key={i} className="flex items-center gap-2 text-sm"><span className={`w-2 h-2 rounded-full ${a.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'}`} /><span className="text-gray-300">{a.alarm_type.replace(/_/g, ' ')}: {a.metric_value}{a.unit}</span></div>)}</div>
            </div>
            <div><label className="text-xs text-gray-400 mb-1 block">Root Cause Analysis</label><textarea value={ticketRCA} onChange={e => setTicketRCA(e.target.value)} rows={3} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-white" placeholder="Describe root cause..." /></div>
            <div><label className="text-xs text-gray-400 mb-1 block">Summary</label><textarea value={ticketSummary} onChange={e => setTicketSummary(e.target.value)} rows={3} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-white" placeholder="Ticket summary..." /></div>
            <button onClick={createTicket} disabled={!ticketSummary.trim()} className="w-full py-2 rounded-lg bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30 disabled:opacity-40 text-sm font-medium">Submit Ticket</button>
          </div>
        </div>
      </div>}
    </div>
  )
}