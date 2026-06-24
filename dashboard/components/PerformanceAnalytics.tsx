'use client'

interface PerformanceData {
  avg_latency: number
  avg_ebr_latency: number
  avg_packet_loss: number
  avg_availability: number
}

interface PerformanceAnalyticsProps {
  data: PerformanceData
}

function formatValue(value: any, unit: string): string {
  const num = Number(value)
  if (value == null || isNaN(num)) return `-- ${unit}`
  return `${num.toFixed(2)} ${unit}`
}

function latencyColor(value: any): string {
  const num = Number(value)
  if (num < 50) return 'text-emerald-400'
  if (num < 100) return 'text-amber-400'
  return 'text-red-400'
}

function packetLossColor(value: any): string {
  const num = Number(value)
  if (num < 1) return 'text-emerald-400'
  if (num < 5) return 'text-amber-400'
  return 'text-red-400'
}

function availabilityColor(value: any): string {
  const num = Number(value)
  if (num >= 99.9) return 'text-emerald-400'
  if (num >= 99) return 'text-amber-400'
  return 'text-red-400'
}

export default function PerformanceAnalytics({ data }: PerformanceAnalyticsProps) {
  const metrics = [
    {
      label: 'Avg Latency',
      value: formatValue(data.avg_latency, 'ms'),
      color: latencyColor(data.avg_latency),
    },
    {
      label: 'Avg EBR Latency',
      value: formatValue(data.avg_ebr_latency, 'ms'),
      color: latencyColor(data.avg_ebr_latency),
    },
    {
      label: 'Avg Packet Loss',
      value: formatValue(data.avg_packet_loss, '%'),
      color: packetLossColor(data.avg_packet_loss),
    },
    {
      label: 'Avg Availability',
      value: formatValue(data.avg_availability, '%'),
      color: availabilityColor(data.avg_availability),
    },
  ]

  return (
    <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-5">
      <h3 className="text-base font-semibold text-white mb-4">Performance Analytics</h3>
      <div className="grid grid-cols-2 gap-4">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-xl bg-slate-700/30 border border-slate-600/30 p-4 flex flex-col items-center text-center"
          >
            <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider">{m.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
