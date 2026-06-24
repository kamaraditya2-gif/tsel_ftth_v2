'use client'

import { useState, useEffect } from 'react'
import { Search, ChevronDown } from 'lucide-react'

interface FilterValues {
  area_id: string
  regional_id: string
  nop_id: string
  brand: string
  ont_type: string
  profile: string
  search: string
}

interface GlobalFilterProps {
  onFilterChange: (filters: FilterValues) => void
  showSearch?: boolean
  showBrand?: boolean
  showOntType?: boolean
  showProfile?: boolean
}

export default function GlobalFilter({ onFilterChange, showSearch = true, showBrand = true, showOntType = true, showProfile = true }: GlobalFilterProps) {
  const [areas, setAreas] = useState<any[]>([])
  const [regionals, setRegionals] = useState<any[]>([])
  const [nops, setNops] = useState<any[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [ontTypes, setOntTypes] = useState<string[]>([])
  const [profiles, setProfiles] = useState<any[]>([])
  const [filters, setFilters] = useState<FilterValues>({
    area_id: '', regional_id: '', nop_id: '', brand: '', ont_type: '', profile: '', search: ''
  })

  useEffect(() => {
    fetch('/api/master-area').then(r => r.json()).then(d => setAreas(Array.isArray(d) ? d : [])).catch(() => {})
    fetch('/api/downstream-servers').then(r => r.json()).then(d => setRegionals(Array.isArray(d) ? d : [])).catch(() => {})
    fetch('/api/speed-groups').then(r => r.json()).then(d => setProfiles(Array.isArray(d) ? d : [])).catch(() => {})
    fetchBrands()
    fetchOntTypes()
  }, [])

  const fetchBrands = async () => {
    try {
      const res = await fetch('/api/devices?fields=manufacturer')
      const data = await res.json()
      if (Array.isArray(data)) {
        const b = Array.from(new Set(data.map((d: any) => d.manufacturer).filter(Boolean))).sort()
        setBrands(b)
      }
    } catch {}
  }

  const fetchOntTypes = async () => {
    try {
      const res = await fetch('/api/devices?fields=cpe_type')
      const data = await res.json()
      if (Array.isArray(data)) {
        const o = Array.from(new Set(data.map((d: any) => d.cpe_type).filter(Boolean))).sort()
        setOntTypes(o)
      }
    } catch {}
  }

  const fetchNops = async (areaId?: string, regionalId?: string) => {
    try {
      const params = new URLSearchParams()
      if (areaId) params.set('area_id', areaId)
      if (regionalId) params.set('regional_id', regionalId)
      const res = await fetch(`/api/master-cluster-nop?${params}`)
      const data = await res.json()
      setNops(Array.isArray(data) ? data : [])
    } catch {}
  }

  const updateFilter = (key: keyof FilterValues, value: string) => {
    const newFilters = { ...filters, [key]: value }

    if (key === 'area_id') {
      newFilters.regional_id = ''
      newFilters.nop_id = ''
      fetchNops(value, undefined)
    }
    if (key === 'regional_id') {
      newFilters.nop_id = ''
      fetchNops(filters.area_id, value)
    }

    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const selectClass = "px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px]"

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {showSearch && (
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search device/serial..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      <select className={selectClass} value={filters.area_id} onChange={(e) => updateFilter('area_id', e.target.value)}>
        <option value="">All Areas</option>
        {areas.map((a: any) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>

      <select className={selectClass} value={filters.regional_id} onChange={(e) => updateFilter('regional_id', e.target.value)}>
        <option value="">All Regionals</option>
        {regionals
          .filter((r: any) => !filters.area_id || r.area_id === parseInt(filters.area_id) || true)
          .map((r: any) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
      </select>

      <select className={selectClass} value={filters.nop_id} onChange={(e) => updateFilter('nop_id', e.target.value)}>
        <option value="">All NOPs</option>
        {nops.map((n: any) => (
          <option key={n.id} value={n.id}>{n.name}</option>
        ))}
      </select>

      {showBrand && (
        <select className={selectClass} value={filters.brand} onChange={(e) => updateFilter('brand', e.target.value)}>
          <option value="">All Brands</option>
          {brands.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      )}

      {showOntType && (
        <select className={selectClass} value={filters.ont_type} onChange={(e) => updateFilter('ont_type', e.target.value)}>
          <option value="">All ONT Types</option>
          {ontTypes.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      )}

      {showProfile && (
        <select className={selectClass} value={filters.profile} onChange={(e) => updateFilter('profile', e.target.value)}>
          <option value="">All Profiles</option>
          {profiles.map((p: any) => (
            <option key={p.id} value={p.name}>{p.name}</option>
          ))}
        </select>
      )}
    </div>
  )
}