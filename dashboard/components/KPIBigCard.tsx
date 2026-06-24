'use client'

import type { LucideIcon } from 'lucide-react'

interface KPIBigCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  color: string
  subtitle?: string
}

export default function KPIBigCard({ title, value, icon: Icon, color, subtitle }: KPIBigCardProps) {
  return (
    <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6 flex flex-col items-center text-center">
      <div className={`p-3 rounded-full bg-gradient-to-br ${color} shadow-lg mb-4`}>
        <Icon className="w-7 h-7 text-white" />
      </div>
      <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-2">{title}</h3>
      <p className="text-4xl font-bold text-white mb-1">{value}</p>
      {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
    </div>
  )
}
