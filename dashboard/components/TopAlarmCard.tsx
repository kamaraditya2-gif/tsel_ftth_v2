'use client'

import type { LucideIcon } from 'lucide-react'

interface TopAlarmItem {
  name: string
  count: number
}

interface TopAlarmCardProps {
  title: string
  data: TopAlarmItem[]
  icon: LucideIcon
}

const BADGE_COLORS = [
  'bg-red-500/20 text-red-400',
  'bg-orange-500/20 text-orange-400',
  'bg-amber-500/20 text-amber-400',
  'bg-blue-500/20 text-blue-400',
  'bg-violet-500/20 text-violet-400',
]

export default function TopAlarmCard({ title, data, icon: Icon }: TopAlarmCardProps) {
  const items = (data || []).slice(0, 5)
  const maxCount = items.length > 0 ? Math.max(...items.map((d) => d.count)) : 0

  return (
    <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-slate-400" />
        <h3 className="text-base font-semibold text-white">{title}</h3>
      </div>

      {items.length === 0 ? (
        <div className="py-8 flex items-center justify-center text-sm text-slate-500">No data available</div>
      ) : (
        <ul className="space-y-2">
          {items.map((item, idx) => {
            const pct = maxCount > 0 ? (item.count / maxCount) * 100 : 0
            return (
              <li key={item.name}>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-slate-200 truncate mr-2">{item.name}</span>
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0 ${BADGE_COLORS[idx % BADGE_COLORS.length]}`}>
                    {item.count}
                  </span>
                </div>
                <div className="h-1 w-full rounded-full bg-slate-700/50 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-slate-500 to-slate-400 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
