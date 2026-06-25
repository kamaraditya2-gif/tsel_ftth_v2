'use client'

import { useState, useEffect, useRef } from 'react'
import { MapPin, ChevronRight } from 'lucide-react'

interface Props { onFilterChange: (areaId: number | null, regionalId: number | null, nopId: number | null) => void }
interface Item { area_id: number; area_name: string; regional_id: number; regional_name: string; nop_id: number; nop_name: string; device_count: number }

export default function LocationFilter({ onFilterChange }: Props) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [ha, setHa] = useState<number | null>(null)
  const [hr, setHr] = useState<number | null>(null)
  const [sel, setSel] = useState<{ type: string; id: number; label: string } | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/location/counts').then(r => r.json()).then(d => setItems(d.data || [])).catch(() => {})
  }, [])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const pick = (type: string, id: number, label: string) => {
    setSel({ type, id, label })
    setOpen(false); setHa(null); setHr(null)
    onFilterChange(type === 'area' ? id : null, type === 'regional' ? id : null, type === 'nop' ? id : null)
  }

  // Aggregate areas
  const areaIds = items.reduce((acc: number[], i) => { if (!acc.includes(i.area_id)) acc.push(i.area_id); return acc }, [])
  const areas = areaIds.map(aid => ({
    id: aid,
    name: items.find(i => i.area_id === aid)?.area_name || '',
    count: items.filter(i => i.area_id === aid).reduce((s, i) => s + Number(i.device_count), 0)
  }))

  // Get regionals for an area
  const getRegs = (areaId: number) => {
    const regIds = items.filter(i => i.area_id === areaId).reduce((acc: number[], i) => { if (!acc.includes(i.regional_id)) acc.push(i.regional_id); return acc }, [])
    return regIds.map(rid => ({
      id: rid,
      name: items.find(i => i.regional_id === rid)?.regional_name || '',
      count: items.filter(i => i.regional_id === rid).reduce((s, i) => s + Number(i.device_count), 0)
    }))
  }

  // Get NOPs for a regional
  const getNops = (regionalId: number) =>
    items.filter(i => i.regional_id === regionalId).map(n => ({ id: n.nop_id, name: n.nop_name, count: Number(n.device_count) }))

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-500/30 bg-white/10 backdrop-blur-md text-xs text-white hover:bg-white/20 transition-all shadow-lg shadow-red-500/20">
        <MapPin className="w-3.5 h-3.5 text-red-300" />
        <span className="truncate max-w-[130px]">{sel ? sel.label : 'Location'}</span>
        <ChevronRight className={`w-3 h-3 text-red-300 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 bg-slate-900/95 backdrop-blur-md border border-red-500/30 rounded-lg shadow-xl z-50 min-w-[220px] py-1">
          <button onClick={() => pick('area', 0, 'All Locations')}
            className="w-full text-left px-4 py-2 text-xs text-white hover:bg-red-500/20">All Locations</button>
          <div className="border-t border-slate-700/50 my-1" />

          {areas.map(a => (
            <div key={a.id} className="relative group" onMouseEnter={() => { setHa(a.id); setHr(null) }}>
              <button onClick={() => pick('area', a.id, a.name)}
                className="w-full flex items-center justify-between px-4 py-2 text-xs text-white hover:bg-red-500/20">
                <span>{a.name}</span>
                <span className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-500">{a.count}</span>
                  <ChevronRight className="w-2.5 h-2.5 text-gray-500" />
                </span>
              </button>

              {ha === a.id && (
                <div className="absolute left-full top-0 ml-1 bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-lg shadow-xl z-50 min-w-[220px] py-1">
                  <button onClick={() => pick('regional', 0, a.name)}
                    className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-red-500/20 italic">
                    All {a.name} ({a.count})
                  </button>
                  <div className="border-t border-slate-700/50 my-1" />
                  {getRegs(a.id).map(r => (
                    <div key={r.id} className="relative group" onMouseEnter={() => setHr(r.id)}>
                      <button onClick={() => pick('regional', r.id, r.name)}
                        className="w-full flex items-center justify-between px-4 py-2 text-xs text-white hover:bg-red-500/20">
                        <span>{r.name}</span>
                        <span className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-500">{r.count}</span>
                          <ChevronRight className="w-2.5 h-2.5 text-gray-500" />
                        </span>
                      </button>

                      {hr === r.id && (
                        <div className="absolute left-full top-0 ml-1 bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-lg shadow-xl z-50 min-w-[220px] max-h-[300px] overflow-y-auto py-1">
                          <button onClick={() => pick('regional', r.id, r.name)}
                            className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-red-500/20 italic">
                            All {r.name} ({r.count})
                          </button>
                          <div className="border-t border-slate-700/50 my-1" />
                          {getNops(r.id).map(n => (
                            <button key={n.id} onClick={() => pick('nop', n.id, n.name)}
                              className="w-full flex items-center justify-between px-4 py-2 text-xs text-white hover:bg-red-500/20">
                              <span>{n.name}</span>
                              <span className="text-[10px] text-gray-500">{n.count}</span>
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