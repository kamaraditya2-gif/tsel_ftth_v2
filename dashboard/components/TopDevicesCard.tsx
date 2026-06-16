'use client'

import { Download } from 'lucide-react'

interface TopDevice {
  id: number
  deviceName: string | null
  serialNumber: string | null
  indihomeId: string | null
  regionalName: string | null
  speedName: string | null
  value: number
  threshold?: number
}

interface TopDevicesCardProps {
  title: string
  data: TopDevice[]
  unit: string
  accent: 'red' | 'orange' | 'amber'
  onDownload: () => void
  showThreshold?: boolean
}

const accentMap = {
  red: { bar: 'bg-red-500', barTrack: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400' },
  orange: { bar: 'bg-orange-500', barTrack: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400' },
  amber: { bar: 'bg-amber-500', barTrack: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400' }
}

function rankClasses(rank: number): string {
  switch (rank) {
    case 1:
      return 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white'
    case 2:
      return 'bg-gradient-to-br from-gray-300 to-gray-400 text-white'
    case 3:
      return 'bg-gradient-to-br from-amber-600 to-amber-700 text-white'
    default:
      return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
  }
}

export default function TopDevicesCard({ title, data, unit, accent, onDownload, showThreshold = false }: TopDevicesCardProps) {
  const colors = accentMap[accent]
  const rows = (data || []).filter((d) => d.value > 0).slice(0, 5)
  const maxValue = rows.length > 0 ? Math.max(...rows.map((d) => d.value)) : 0

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white leading-snug">{title}</h2>
        <button
          onClick={onDownload}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          CSV
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-10 text-sm text-gray-400 dark:text-gray-500">
          No data available
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((device, index) => {
            const rank = index + 1
            const pct = maxValue > 0 ? (device.value / maxValue) * 100 : 0
            return (
              <li key={device.id} className="flex items-center gap-3">
                <span
                  className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 ${rankClasses(rank)}`}
                >
                  {rank}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate" title={device.deviceName || ''}>
                      {device.deviceName || device.serialNumber || 'Unknown'}
                    </p>
                    {showThreshold && device.threshold ? (
                      <div className="flex items-center gap-1.5">
                        <span className={`text-sm font-bold tabular-nums shrink-0 ${colors.text}`}>
                          {device.value.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">/ {device.threshold.toFixed(0)}</span>
                        <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">{unit}</span>
                      </div>
                    ) : (
                      <span className={`text-sm font-bold tabular-nums shrink-0 ${colors.text}`}>
                        {device.value.toFixed(2)}
                        <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 ml-0.5">{unit}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 mb-1.5">
                    {device.indihomeId && (
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{device.indihomeId}</span>
                    )}
                    {device.regionalName && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 truncate">
                        {device.regionalName}
                      </span>
                    )}
                    {device.speedName && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 truncate">
                        {device.speedName}
                      </span>
                    )}
                  </div>
                  <div className={`h-1.5 w-full rounded-full overflow-hidden ${colors.barTrack}`}>
                    <div className={`h-full rounded-full ${colors.bar} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
