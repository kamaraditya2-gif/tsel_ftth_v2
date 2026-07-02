'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { MapPin, CheckSquare, Square, X } from 'lucide-react'

interface Props { onFilterChange: (f: { areaIds: number[]; regionalIds: number[]; nopIds: number[] }) => void }
interface Item { area_id: number; area_name: string; regional_id: number; regional_name: string; nop_id: number; nop_name: string; device_count: number }

export default function LocationFilter({ onFilterChange }: Props) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [draft, setDraft] = useState<{ areaIds: number[]; regionalIds: number[]; nopIds: number[] }>({ areaIds: [], regionalIds: [], nopIds: [] })
  const [sel, setSel] = useState<{ areaIds: number[]; regionalIds: number[]; nopIds: number[] }>({ areaIds: [], regionalIds: [], nopIds: [] })

  useEffect(() => {
    fetch('/api/location/counts').then(r => r.json()).then(d => setItems(d.data || [])).catch(() => {})
  }, [])

  const total = sel.areaIds.length + sel.regionalIds.length + sel.nopIds.length

  const areas = useMemo(() => {
    const areaIds = items.reduce((acc: number[], i) => { if (!acc.includes(i.area_id)) acc.push(i.area_id); return acc }, [])
    return areaIds.map(aid => ({
      id: aid,
      name: items.find(i => i.area_id === aid)?.area_name || '',
      count: items.filter(i => i.area_id === aid).reduce((s, i) => s + Number(i.device_count), 0)
    }))
  }, [items])

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

  const inDraft = (arr: number[], id: number) => arr.includes(id)
  const toggleDraft = (arr: keyof typeof draft, id: number) => {
    setDraft(prev => ({
      ...prev,
      [arr]: prev[arr].includes(id) ? prev[arr].filter(x => x !== id) : [...prev[arr], id]
    }))
  }

  const toggleAreaDraft = (aid: number) => {
    const regs = getRegs(aid)
    const nops = regs.flatMap(r => getNops(r.id))
    if (inDraft(draft.areaIds, aid)) {
      setDraft(prev => ({
        areaIds: prev.areaIds.filter(x => x !== aid),
        regionalIds: prev.regionalIds.filter(x => !regs.some(r => r.id === x)),
        nopIds: prev.nopIds.filter(x => !nops.some(n => n.id === x))
      }))
    } else {
      setDraft(prev => ({
        areaIds: [...prev.areaIds, aid],
        regionalIds: [...prev.regionalIds, ...regs.map(r => r.id).filter(x => !prev.regionalIds.includes(x))],
        nopIds: [...prev.nopIds, ...nops.map(n => n.id).filter(x => !prev.nopIds.includes(x))]
      }))
    }
  }

  const toggleRegionalDraft = (rid: number) => {
    const nops = getNops(rid)
    if (inDraft(draft.regionalIds, rid)) {
      setDraft(prev => ({
        ...prev,
        regionalIds: prev.regionalIds.filter(x => x !== rid),
        nopIds: prev.nopIds.filter(x => !nops.some(n => n.id === x))
      }))
    } else {
      setDraft(prev => ({
        ...prev,
        regionalIds: [...prev.regionalIds, rid],
        nopIds: [...prev.nopIds, ...nops.map(n => n.id).filter(x => !prev.nopIds.includes(x))]
      }))
    }
  }

  const openModal = () => {
    setDraft({ ...sel })
    setOpen(true)
  }

  const apply = () => {
    setSel({ ...draft })
    setOpen(false)
    onFilterChange(draft)
  }

  const clearAll = () => {
    setDraft({ areaIds: [], regionalIds: [], nopIds: [] })
  }

  const Check = ({ on }: { on: boolean }) => on
    ? <CheckSquare className="w-4 h-4 text-red-400 shrink-0" />
    : <Square className="w-4 h-4 text-gray-500 shrink-0" />

  return (
    <>
      <button onClick={openModal}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-500/30 bg-white/10 backdrop-blur-md text-xs text-white hover:bg-white/20 transition-all shadow-lg shadow-red-500/20">
        <MapPin className="w-3.5 h-3.5 text-red-300" />
        <span className="truncate max-w-[130px]">{total > 0 ? `${total} selected` : 'Location'}</span>
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-[100] p-4 pt-12" onClick={() => setOpen(false)}>
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-red-400" /> Filter Location
              </h3>
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-4 h-4 text-gray-400" /></button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {areas.map(a => (
                <div key={a.id} className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                  <button onClick={() => toggleAreaDraft(a.id)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-white hover:bg-white/5 font-medium">
                    <Check on={inDraft(draft.areaIds, a.id)} />
                    <span>{a.name}</span>
                    <span className="ml-auto text-[10px] text-gray-500">{a.count}</span>
                  </button>

                  {getRegs(a.id).map(r => (
                    <div key={r.id}>
                      <button onClick={() => toggleRegionalDraft(r.id)}
                        className="w-full flex items-center gap-2 pl-8 pr-3 py-2 text-xs text-gray-200 hover:bg-white/5">
                        <Check on={inDraft(draft.regionalIds, r.id)} />
                        <span>{r.name}</span>
                        <span className="ml-auto text-[10px] text-gray-500">{r.count}</span>
                      </button>

                      <div className="pl-12">
                        {getNops(r.id).map(n => (
                          <button key={n.id} onClick={() => toggleDraft('nopIds', n.id)}
                            className="w-full flex items-center gap-2 pr-3 py-1.5 text-xs text-gray-400 hover:bg-white/5">
                            <Check on={inDraft(draft.nopIds, n.id)} />
                            <span>{n.name}</span>
                            <span className="ml-auto text-[10px] text-gray-500">{n.count}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 p-4 border-t border-slate-700/50">
              <button onClick={clearAll} className="px-3 py-2 text-xs text-gray-400 hover:text-white">Clear all</button>
              <div className="flex gap-2">
                <button onClick={() => setOpen(false)} className="px-4 py-2 text-xs text-gray-400 hover:text-white bg-slate-800 rounded-lg">Cancel</button>
                <button onClick={apply}
                  className="px-5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg">{total > 0 ? `Apply (${total})` : 'Apply'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
