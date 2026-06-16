'use client'

interface MiniChartProps {
  data: number[]
  color?: string
  height?: number
}

export default function MiniChart({ data, color = '#3b82f6', height = 30 }: MiniChartProps) {
  if (!data || data.length === 0) return null

  const width = 100
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  
  // Normalize data to fit in the chart
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * (width - 10) + 5
    const y = height - 5 - ((value - min) / range) * (height - 10)
    return { x, y }
  })

  // Create polygon points for fill area
  const polygonPoints = [
    `${points[0].x},${height}`,
    ...points.map(p => `${p.x},${p.y}`),
    `${points[points.length - 1].x},${height}`
  ].join(' ')

  // Create polyline points for line
  const linePoints = points.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <div className="relative w-full" style={{ height }}>
      <svg 
        width="100%" 
        height={height} 
        className="overflow-visible" 
        preserveAspectRatio="none"
      >
        <g>
          {/* Fill area */}
          <polygon
            points={polygonPoints}
            fill={color}
            opacity="0.2"
          />
          {/* Line */}
          <polyline
            points={linePoints}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-all duration-300"
          />
        </g>
      </svg>
    </div>
  )
}
