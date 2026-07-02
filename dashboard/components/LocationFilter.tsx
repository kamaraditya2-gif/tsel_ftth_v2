'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { MapPin, CheckSquare, Square, ChevronRight } from 'lucide-react'

interface Props { onFilterChange: (f: { areaIds: number[]; regionalIds: number[]; nopIds: number[] }) => void }
interface Item { area_id: number; area_name: string; regional_id: number; regional_name: string; nop_id: number; nop_name: string; device_count: number }

export default function LocationFilter({ onFilterChange }: Props) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [sel, setSel] = useState<{ areaIds: number[]; regionalIds: number[]; nopIds: number[] }>({ areaIds: [], regionalIds: [], nopIds: [] })
  const [ha, setHa] = useState<number | null>(null)
  const [hr, setHr] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/location/counts').then(r => r.json()).then(d => setItems(d.data || [])).catch(() => {})
  }, [])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const total = sel.areaIds.length + sel.regionalIds.length + sel.nopIds.length

  const areaIds = useMemo(() => items.reduce((acc: number[], i) => { if (!acc.includes(i.area_id)) acc.push(i.area_id); return acc }, []), [items])
  const areas = useMemo(() => areaIds.map(aid => ({
    id: aid,
    name: items.find(i => i.area_id === aid)?.area_name || '',
    count: items.filter(i => i.area_id === aid).reduce((s, i) => s + Number(i.device_count), 0)
  })), [items])

  const getRegs = (areaId: number) => {
    const regIds = items.filter(i => i.area_id === areaId).reduce((acc: number[], i) => { if (!acc.includes(i.regional_id)) acc.push(i.regional_id); return acc }, [])
    return regIds.map(rid => ({
      id: rid,
      name: items.find(i => i.regional_id === rid)?.regional_name || '',
      count: items.filter(i => i.regional_id === rid).reduce((s, i) => s + Number(i.device_count), 0)
    }))
  }

  const getNops = (regionalId: number) =>
    items.filter(i => i.regional_id === regionalId).map(n => ({ id: n.nop_id, name: n.nop_name, count: Number(n.device_count) }))

  const toggleArea = (id: number) => {
    const regs = getRegs(id)
    const nops = regs.flatMap(r => getNops(r.id))
    const on = !sel.areaIds.includes(id)
    const ns = { ...sel }
    if (on) {
      ns.areaIds = [...ns.areaIds, id]
      ns.regionalIds = [...ns.regionalIds, ...regs.map(r => r.id).filter(x => !ns.regionalIds.includes(x))]
      ns.nopIds = [...ns.nopIds, ...nops.map(n => n.id).filter(x => !ns.nopIds.includes(x))]
    } else {
      ns.areaIds = ns.areaIds.filter(x => x !== id)
      ns.regionalIds = ns.regionalIds.filter(x => !regs.some(r => r.id === x))
      ns.nopIds = ns.nopIds.filter(x => !nops.some(n => n.id === x))
    }
    setSel(ns); onFilterChange(ns)
  }

  const toggleRegional = (rid: number) => {
    const nops = getNops(rid)
    const on = !sel.regionalIds.includes(rid)
    const ns = { ...sel }
    if (on) {
      ns.regionalIds = [...ns.regionalIds, rid]
      ns.nopIds = [...ns.nopIds, ...nops.map(n => n.id).filter(x => !ns.nopIds.includes(x))]
    } else {
      ns.regionalIds = ns.regionalIds.filter(x => x !== rid)
      ns.nopIds = ns.nopIds.filter(x => !nops.some(n => n.id === x))
    }
    setSel(ns); onFilterChange(ns)
  }

  const toggleNop = (nid: number) => {
    const on = !sel.nopIds.includes(nid)
    const ns = { ...sel }
    if (on) ns.nopIds = [...ns.nopIds, nid]
    else ns.nopIds = ns.nopIds.filter(x => x !== nid)
    setSel(ns); onFilterChange(ns)
  }

  const clearAll = () => {
    setSel({ areaIds: [], regionalIds: [], nopIds: [] })
    onFilterChange({ areaIds: [], regionalIds: [], nopIds: [] })
    setOpen(false); setHa(null); setHr(null)
  }

  const Check = ({ on }: { on: boolean }) => on
    ? <CheckSquare className="w-3.5 h-3.5 text-red-400 shrink-0" />
    : <Square className="w-3.5 h-3.5 text-gray-500 shrink-0" />

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-500/30 bg-white/10 backdrop-blur-md text-xs text-white hover:bg-white/20 transition-all shadow-lg shadow-red-500/20">
        <MapPin className="w-3.5 h-3.5 text-red-300" />
        <span className="truncate max-w-[130px]">{total > 0 ? `${total} selected` : 'Location'}</span>
        <ChevronRight className={`w-3 h-3 text-red-300 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 bg-slate-900/95 backdrop-blur-md border border-red-500/30 rounded-lg shadow-xl z-50 min-w-[240px] py-1 max-h-[60vh] overflow-y-auto">
          <button onClick={clearAll}
            className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-red-500/20 italic">Clear all</button>
          <div className="border-t border-slate-700/50 my-1" />

          {areas.map(a => (
            <div key={a.id} className="relative group" onMouseEnter={() => { setHa(a.id); setHr(null) }}>
              <button onClick={() => toggleArea(a.id)}
                className="w-full flex items-center gap-2 px-4 py-2 text-xs text-white hover:bg-red-500/20">
                <Check on={sel.areaIds.includes(a.id)} />
                <span>{a.name}</span>
                <span className="ml-auto text-[10px] text-gray-500">{a.count}</span>
                <ChevronRight className="w-2.5 h-2.5 text-gray-500" />
              </button>

              {ha === a.id && (
                <div className="absolute left-full top-0 ml-1 bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-lg shadow-xl z-50 min-w-[240px] py-1 max-h-[50vh] overflow-y-auto">
                  {getRegs(a.id).map(r => (
                    <div key={r.id} className="relative group" onMouseEnter={() => setHr(r.id)}>
                      <button onClick={() => toggleRegional(r.id)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-xs text-white hover:bg-red-500/20">
                        <Check on={sel.regionalIds.includes(r.id)} />
                        <span>{r.name}</span>
                        <span className="ml-auto text-[10px] text-gray-500">{r.count}</span>
                        <ChevronRight className="w-2.5 h-2.5 text-gray-500" />
                      </button>

                      {hr === r.id && (
                        <div className="absolute left-full top-0 ml-1 bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-lg shadow-xl z-50 min-w-[240px] max-h-[300px] overflow-y-auto py-1">
                          {getNops(r.id).map(n => (
                            <button key={n.id} onClick={() => toggleNop(n.id)}
                              className="w-full flex items-center gap-2 px-4 py-2 text-xs text-white hover:bg-red-500/20">
                              <Check on={sel.nopIds.includes(n.id)} />
                              <span>{n.name}</span>
                              <span className="ml-auto text-[10px] text-gray-500">{n.count}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
