'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, AlertTriangle, Upload, Download } from 'lucide-react'

interface ThresholdData {
  upload: {
    above_threshold: number
    below_threshold: number
  }
  download: {
    above_threshold: number
    below_threshold: number
  }
}

interface ThresholdChartProps {
  timeRange?: string
  areaId?: string
  regionalId?: string
  nopId?: string
  speedGroupId?: string
}

export default function ThresholdChart({ timeRange = '24h', areaId, regionalId, nopId, speedGroupId }: ThresholdChartProps) {
  const [data, setData] = useState<ThresholdData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const params = new URLSearchParams({ timeRange })
        if (areaId) params.append('areaId', areaId)
        if (regionalId) params.append('regionalId', regionalId)
        if (nopId) params.append('nopId', nopId)
        if (speedGroupId) params.append('speedGroupId', speedGroupId)

        const response = await fetch(`/api/dashboard/threshold?${params}`)
        const result = await response.json()
        if (result.upload && result.download) {
          setData(result)
        } else {
          setData({ upload: { above_threshold: 0, below_threshold: 0 }, download: { above_threshold: 0, below_threshold: 0 } })
        }
      } catch (error) {
        console.error('Error fetching threshold data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [timeRange, regionalId, speedGroupId])

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-lg shadow-sm p-2 border border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Speed Threshold Comparison</h3>
        <div className="h-80 flex items-center justify-center">
          <div className="text-gray-500 dark:text-gray-400">Loading...</div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-lg shadow-sm p-2 border border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Speed Threshold Comparison</h3>
        <div className="h-80 flex items-center justify-center">
          <div className="text-gray-500 dark:text-gray-400">No data available</div>
        </div>
      </div>
    )
  }

  const metrics = [
    {
      key: 'download',
      label: 'Download',
      Icon: Download,
      above: data.download.above_threshold,
      below: data.download.below_threshold,
      accent: 'blue'
    },
    {
      key: 'upload',
      label: 'Upload',
      Icon: Upload,
      above: data.upload.above_threshold,
      below: data.upload.below_threshold,
      accent: 'violet'
    }
  ] as const

  const totalAbove = data.upload.above_threshold + data.download.above_threshold
  const totalBelow = data.upload.below_threshold + data.download.below_threshold
  const grandTotal = totalAbove + totalBelow
  const overallCompliance = grandTotal > 0 ? Math.round((totalAbove / grandTotal) * 100) : 0

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-lg shadow-sm p-2 border border-gray-200 dark:border-gray-700">
      <div className="flex flex-col gap-2 mb-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-[8px] font-bold text-gray-900 dark:text-white">Speed</h3>
          <p className="text-[8px] text-gray-600 dark:text-gray-400 mt-1">Devices meeting their subscribed speed threshold</p>
        </div>
        <div className="flex items-center gap-3">
          <ComplianceRing percent={overallCompliance} size={24} stroke={4} />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Overall compliance</p>
            <p className="text-[10px] font-bold text-gray-900 dark:text-white">{overallCompliance}%</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{totalAbove} of {grandTotal} tests</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {metrics.map((m) => {
          const total = m.above + m.below
          const compliance = total > 0 ? Math.round((m.above / total) * 100) : 0
          const abovePct = total > 0 ? (m.above / total) * 100 : 0
          const belowPct = total > 0 ? (m.below / total) * 100 : 0
          return (
            <div
              key={m.key}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/40 p-1.5"
            >
              <div className="flex items-center gap-2">
                <ComplianceRing percent={compliance} size={84} stroke={9} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <m.Icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span className="font-semibold text-gray-900 dark:text-white">{m.label}</span>
                  </div>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white leading-none">{compliance}%</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {total} device{total !== 1 ? 's' : ''} tested
                  </p>
                </div>
              </div>

              {/* Proportion bar */}
              <div className="mt-4">
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div className="bg-emerald-500 transition-all" style={{ width: `${abovePct}%` }} />
                  <div className="bg-red-500 transition-all" style={{ width: `${belowPct}%` }} />
                </div>
              </div>

              {/* Counts */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-none">Above</p>
                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 leading-tight">{m.above}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
                  <div>
                    <p className="text-[11px] text-red-800 dark:text-red-300 leading-none">Below</p>
                    <p className="text-lg font-bold text-red-700 dark:text-red-400 leading-tight">{m.below}</p>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ComplianceRing({ percent, size = 80, stroke = 8 }: { percent: number; size?: number; stroke?: number }) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, percent))
  const offset = circumference - (clamped / 100) * circumference
  // Color shifts with compliance level: red < 50, amber < 80, green otherwise.
  const color = clamped >= 80 ? '#10b981' : clamped >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-gray-200 dark:stroke-gray-700"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-bold text-gray-900 dark:text-white" style={{ fontSize: size * 0.26 }}>
          {clamped}%
        </span>
      </div>
    </div>
  )
}
