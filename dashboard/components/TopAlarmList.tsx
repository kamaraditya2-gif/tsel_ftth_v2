'use client'

import { useState } from 'react'
import { AlertTriangle, X, Clock, Activity, Download, Upload } from 'lucide-react'

interface TopAlarmItem { device_id: number; serial_number: string; device_name: string; consecutive_days: number }

export default function TopAlarmList({ data, onDetail }: { data: TopAlarmItem[]; onDetail?: (d: any) => void }) {
  const items = data || []
  if (items.length === 0) return null

  return (
    <div className="rounded-xl border border-rose-500/20 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-md p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-rose-400" />
        <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Top Alarm</h4>
        <span className="text-[9px] text-gray-500 ml-auto">&ge;7 days consecutive failure</span>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={item.device_id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
            onClick={() => onDetail?.(item)}>
            <div>
              <p className="text-sm text-white font-medium">{item.device_name || item.serial_number}</p>
              <p className="text-[10px] text-gray-400">{item.serial_number}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-rose-400" />
              <span className="text-sm font-bold text-rose-400">{item.consecutive_days}</span>
              <span className="text-[9px] text-gray-500">days</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
