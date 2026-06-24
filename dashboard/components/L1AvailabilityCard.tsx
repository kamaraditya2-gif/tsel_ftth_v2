'use client'

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

interface AvailabilityItem {
  alarm_type: string
  l1_count: number
  l2_count: number
}

interface L1AvailabilityCardProps {
  data: AvailabilityItem[]
}

export default function L1AvailabilityCard({ data }: L1AvailabilityCardProps) {
  const items = (data || []).filter((d) => d.l1_count > 0 || d.l2_count > 0)

  const chartData = items.flatMap((d) => [
    { name: `${d.alarm_type} (L1)`, value: d.l1_count, color: '#ef4444' },
    { name: `${d.alarm_type} (L2)`, value: d.l2_count, color: '#f59e0b' },
  ]).filter((d) => d.value > 0)

  return (
    <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-5">
      <h3 className="text-base font-semibold text-white mb-3">L1 Availability</h3>

      {items.length === 0 ? (
        <div className="h-[280px] flex items-center justify-center text-sm text-slate-500">No data available</div>
      ) : (
        <div className="flex flex-col items-center">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={70}
                innerRadius={35}
              >
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          <div className="w-full mt-3 space-y-2">
            {items.map((item) => (
              <div
                key={item.alarm_type}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-700/30"
              >
                <span className="text-sm text-slate-200">{item.alarm_type}</span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-xs">
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                    <span className="text-red-400 font-medium">{item.l1_count}</span>
                  </span>
                  <span className="flex items-center gap-1 text-xs">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                    <span className="text-amber-400 font-medium">{item.l2_count}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
