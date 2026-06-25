'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, ComposedChart, Legend } from 'recharts'

interface PingChartProps {
  data: any[]
  type?: 'ping' | 'speed' | 'latency'
  unit?: string
}

// Format a timestamp string to WIB (Asia/Jakarta)
function formatWIBLabel(value: string): string {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d.getTime())) return value
  return d.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: 'short'
  })
}

function formatWIBTooltip(value: string): string {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d.getTime())) return value
  return d.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) + ' WIB'
}

export default function PingChart({ data, type = 'ping', unit: customUnit }: PingChartProps) {
  if (!data || data.length === 0) {
    return <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">No data available</div>
  }

  const unit = customUnit || (type === 'speed' ? 'Mbps' : 'ms')

  // Only show entries that carry a real metric in the tooltip (skip range bands).
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const rows = payload.filter((e: any) => e.name && !e.name.startsWith('_') && typeof e.value === 'number')
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{formatWIBTooltip(label)}</p>
          {rows.map((entry: any, index: number) => (
            <p key={index} className="text-sm font-medium" style={{ color: entry.color }}>
              {entry.name}: {Number(entry.value).toFixed(2)} {unit}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div style={{ height: 350 }}>
      <ResponsiveContainer width="100%" height="100%">
        {type === 'latency' ? (
          <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
            <XAxis 
              dataKey="hour" 
              tick={{ fill: '#6b7280', fontSize: 11 }}
              tickLine={{ stroke: '#e5e7eb' }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickFormatter={formatWIBLabel}
              angle={-30}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              tick={{ fill: '#6b7280', fontSize: 12 }}
              tickLine={{ stroke: '#e5e7eb' }}
              axisLine={{ stroke: '#e5e7eb' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              iconType="circle"
              wrapperStyle={{ paddingTop: '10px' }}
            />
            {/* MIN-MAX range bands (rendered behind the avg lines) */}
            <Area
              type="monotone"
              dataKey={(d: any) => [d.igw_min, d.igw_max]}
              stroke="none"
              fill="#3b82f6"
              fillOpacity={0.12}
              name="_igwRange"
              legendType="none"
              activeDot={false}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey={(d: any) => [d.ebr_min, d.ebr_max]}
              stroke="none"
              fill="#8b5cf6"
              fillOpacity={0.12}
              name="_ebrRange"
              legendType="none"
              activeDot={false}
              isAnimationActive={false}
            />
            <Line 
              type="monotone" 
              dataKey="igw" 
              stroke="#3b82f6" 
              strokeWidth={2}
              dot={{ fill: '#3b82f6', r: 3, strokeWidth: 2 }}
              activeDot={{ r: 5, strokeWidth: 2 }}
              animationDuration={1000}
              animationEasing="ease-in-out"
              name="near IGW"
            />
            <Line 
              type="monotone" 
              dataKey="ebr" 
              stroke="#8b5cf6" 
              strokeWidth={2}
              dot={{ fill: '#8b5cf6', r: 3, strokeWidth: 2 }}
              activeDot={{ r: 5, strokeWidth: 2 }}
              animationDuration={1000}
              animationEasing="ease-in-out"
              name="near EBR"
            />
          </ComposedChart>
        ) : type === 'ping' ? (
          <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <defs>
              <linearGradient id="pingGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
            <XAxis 
              dataKey="hour" 
              tick={{ fill: '#6b7280', fontSize: 11 }}
              tickLine={{ stroke: '#e5e7eb' }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickFormatter={formatWIBLabel}
              angle={-30}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              tick={{ fill: '#6b7280', fontSize: 12 }}
              tickLine={{ stroke: '#e5e7eb' }}
              axisLine={{ stroke: '#e5e7eb' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey="avg_ping" 
              stroke="#0ea5e9" 
              strokeWidth={3}
              dot={{ fill: '#0ea5e9', r: 4, strokeWidth: 2 }}
              activeDot={{ r: 6, strokeWidth: 2 }}
              animationDuration={1000}
              animationEasing="ease-in-out"
            />
          </LineChart>
        ) : (
          <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
            <XAxis 
              dataKey="hour" 
              tick={{ fill: '#6b7280', fontSize: 11 }}
              tickLine={{ stroke: '#e5e7eb' }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickFormatter={formatWIBLabel}
              angle={-30}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              tick={{ fill: '#6b7280', fontSize: 12 }}
              tickLine={{ stroke: '#e5e7eb' }}
              axisLine={{ stroke: '#e5e7eb' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              iconType="circle"
              wrapperStyle={{ paddingTop: '10px' }}
            />
            {/* MIN-MAX range bands (rendered behind the avg lines) */}
            <Area
              type="monotone"
              dataKey={(d: any) => [d.min_download, d.max_download]}
              stroke="none"
              fill="#22c55e"
              fillOpacity={0.12}
              name="_downloadRange"
              legendType="none"
              activeDot={false}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey={(d: any) => [d.min_upload, d.max_upload]}
              stroke="none"
              fill="#3b82f6"
              fillOpacity={0.12}
              name="_uploadRange"
              legendType="none"
              activeDot={false}
              isAnimationActive={false}
            />
            <Line 
              type="monotone" 
              dataKey="avg_download" 
              stroke="#22c55e" 
              strokeWidth={2}
              animationDuration={1000}
              animationEasing="ease-in-out"
              name="Download"
              dot={{ fill: '#22c55e', r: 3, strokeWidth: 2 }}
              activeDot={{ r: 5, strokeWidth: 2 }}
            />
            <Line 
              type="monotone" 
              dataKey="avg_upload" 
              stroke="#3b82f6" 
              strokeWidth={2}
              animationDuration={1000}
              animationEasing="ease-in-out"
              name="Upload"
              dot={{ fill: '#3b82f6', r: 3, strokeWidth: 2 }}
              activeDot={{ r: 5, strokeWidth: 2 }}
            />
          </ComposedChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
