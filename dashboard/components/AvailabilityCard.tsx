'use client'

interface AvailabilityData { pct: number; successCount: number; totalCount: number }

export default function AvailabilityCard({ data }: { data: AvailabilityData }) {
  const pct = data?.pct || 0
  const color = pct >= 99.9 ? 'text-emerald-400' : pct >= 99 ? 'text-amber-400' : 'text-red-400'
  const barColor = pct >= 99.9 ? 'bg-emerald-500' : pct >= 99 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-4 text-center">
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Availability</h4>
      <p className={`text-4xl font-bold ${color}`}>{pct.toFixed(2)}%</p>
      <p className="text-[10px] text-gray-500 mt-1">Successful Ping / Total Ping × 100%</p>
      <div className="mt-3 h-2 w-full rounded-full bg-white/10 overflow-hidden">
        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-gray-500 mt-1">{data?.successCount || 0} / {data?.totalCount || 0} successful</p>
    </div>
  )
}
