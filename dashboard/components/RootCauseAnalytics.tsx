'use client'

import { useEffect, useRef } from 'react'

const L1_COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981']
const L2_COLORS = ['#ef4444', '#dc2626', '#f59e0b', '#d97706', '#3b82f6', '#2563eb', '#8b5cf6', '#7c3aed', '#10b981', '#059669']

interface RCItem { name: string; count: number }
interface RootCauseData { l1: RCItem[]; l2: { category: string; name: string; count: number }[] }

function PieCanvas({ data, colors }: { data: RCItem[]; colors: string[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || data.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)

    const cx = w / 2
    const cy = h / 2
    const r = Math.min(cx, cy) - 4
    const total = data.reduce((s, i) => s + i.count, 0)
    let startAngle = -Math.PI / 2

    ctx.clearRect(0, 0, w, h)

    data.forEach((item, i) => {
      const sliceAngle = (item.count / total) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, r, startAngle, startAngle + sliceAngle)
      ctx.closePath()
      ctx.fillStyle = colors[i % colors.length]
      ctx.fill()

      // label
      const midAngle = startAngle + sliceAngle / 2
      const lr = r * 0.6
      const lx = cx + Math.cos(midAngle) * lr
      const ly = cy + Math.sin(midAngle) * lr
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 12px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      if (sliceAngle > 0.08) {
        ctx.fillText(`${(item.count / total * 100).toFixed(0)}%`, lx, ly)
      }

      startAngle += sliceAngle
    })
  }, [data, colors])

  if (data.length === 0) return null

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: 220 }}
    />
  )
}

export default function RootCauseAnalytics({ data }: { data: RootCauseData }) {
  const l1 = data?.l1 || []
  const l2 = data?.l2 || []
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
            <PieCanvas data={l1} colors={L1_COLORS} />
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
