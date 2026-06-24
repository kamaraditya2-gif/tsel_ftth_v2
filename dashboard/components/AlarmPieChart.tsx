'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface AlarmData {
  alarm_type: string
  count: number
  severity: string
}

interface AlarmPieChartProps {
  data: AlarmData[]
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
}

const RADIAN = Math.PI / 180

function renderLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  const radius = outerRadius + 24
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="#94a3b8" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={12}>
      {(percent * 100).toFixed(0)}%
    </text>
  )
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-white font-medium text-sm">{d.alarm_type}</p>
      <p className="text-slate-300 text-xs">Count: {d.count}</p>
      <p className="text-xs capitalize" style={{ color: SEVERITY_COLORS[d.severity] || '#94a3b8' }}>
        {d.severity}
      </p>
    </div>
  )
}

function renderLegend({ payload }: any) {
  if (!payload) return null
  return (
    <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
      {payload.map((entry: any, idx: number) => (
        <li key={idx} className="flex items-center gap-1.5 text-xs text-slate-300">
          <span
            className="w-2.5 h-2.5 rounded-full inline-block"
            style={{ backgroundColor: entry.color }}
          />
          {entry.payload?.alarm_type}: {entry.payload?.count}
        </li>
      ))}
    </ul>
  )
}

export default function AlarmPieChart({ data }: AlarmPieChartProps) {
  const chartData = (data || []).map((d) => ({
    ...d,
    fill: SEVERITY_COLORS[d.severity] || '#64748b',
  }))

  return (
    <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-5">
      <h3 className="text-base font-semibold text-white mb-3">Root Cause Analysis</h3>
      {chartData.length === 0 ? (
        <div className="h-[300px] flex items-center justify-center text-sm text-slate-500">No data available</div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="alarm_type"
              cx="50%"
              cy="50%"
              outerRadius={90}
              innerRadius={45}
              label={renderLabel}
              labelLine={false}
            >
              {chartData.map((entry, idx) => (
                <Cell key={idx} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={renderLegend} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
