'use client'

import { AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react'

interface SeverityData {
  critical: number; major: number; minor: number; total: number
  criticalPct: number; majorPct: number; minorPct: number
}

export default function SeveritySummary({ data }: { data: SeverityData }) {
  const cards = [
    { label: 'Critical', value: data.critical, pct: data.criticalPct, icon: AlertCircle, color: 'from-red-600 to-rose-700', textColor: 'text-red-300', barColor: 'bg-red-500' },
    { label: 'Major', value: data.major, pct: data.majorPct, icon: AlertTriangle, color: 'from-orange-500 to-amber-600', textColor: 'text-orange-300', barColor: 'bg-orange-500' },
    { label: 'Minor', value: data.minor, pct: data.minorPct, icon: CheckCircle, color: 'from-emerald-500 to-green-600', textColor: 'text-emerald-300', barColor: 'bg-emerald-500' },
  ]
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map(c => {
        const Icon = c.icon
        return (
          <div key={c.label} className={`rounded-xl border border-white/10 bg-gradient-to-br ${c.color}/20 p-4 backdrop-blur-md`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-400 uppercase">{c.label}</span>
              <Icon className={`w-5 h-5 ${c.textColor}`} />
            </div>
            <p className={`text-2xl font-bold ${c.textColor}`}>{c.value}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{c.pct}% of tested ONTs ({data.total} total)</p>
            <div className="mt-2 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <div className={`h-full rounded-full ${c.barColor} transition-all`} style={{ width: `${c.pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
