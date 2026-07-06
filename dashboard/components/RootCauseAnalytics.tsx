'use client'

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

const L1_COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981']
const L2_COLORS = ['#ef4444', '#dc2626', '#f59e0b', '#d97706', '#3b82f6', '#2563eb', '#8b5cf6', '#7c3aed', '#10b981', '#059669']

interface RCItem { name: string; count: number }
interface RootCauseData { l1: RCItem[]; l2: { category: string; name: string; count: number }[] }

export default function RootCauseAnalytics({ data }: { data: RootCauseData }) {
  const l1 = data?.l1 || []
  const l2 = data?.l2 || []
  const l1Total = l1.reduce((s, i) => s + i.count, 0)
  const l2Max = Math.max(...l2.map(i => i.count), 1)
  const l2Sorted = [...l2].sort((a, b) => b.count - a.count)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* L1 Pie Chart */}
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-4">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Root Cause L1</h4>
        {l1.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-xs text-gray-500">No data</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                <Pie data={l1} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={75}>
                  {l1.map((_, i) => <Cell key={i} fill={L1_COLORS[i % L1_COLORS.length]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {l1.map((item, i) => (
                <span key={item.name} className="flex items-center gap-1 text-[10px] text-gray-400">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: L1_COLORS[i % L1_COLORS.length] }} />
                  {item.name}: {item.count}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* L2 Horizontal Bar Chart */}
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-4">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Root Cause L2</h4>
        {l2.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-xs text-gray-500">No data</div>
        ) : (
          <div className="space-y-1 max-h-[220px] overflow-y-auto">
            {l2Sorted.map((item, i) => (
              <div key={item.name + item.category} className="flex items-center gap-2 py-0.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="text-[10px] text-gray-300 w-28 truncate shrink-0" title={`${item.name} (${item.category})`}>{item.name}</span>
                <div className="flex-1 h-4 bg-white/5 rounded overflow-hidden">
                  <div className="h-full rounded transition-all" style={{ width: `${(item.count / l2Max) * 100}%`, backgroundColor: L2_COLORS[i % L2_COLORS.length] }} />
                </div>
                <span className="text-[10px] text-gray-400 w-6 text-right shrink-0">{item.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
