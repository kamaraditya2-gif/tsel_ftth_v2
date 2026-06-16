'use client'

interface GaugeProps {
  value: number
  max?: number
  color?: string
  label?: string
  size?: number
}

export default function Gauge({ 
  value, 
  max = 100, 
  color = '#3b82f6', 
  label,
  size = 120 
}: GaugeProps) {
  const percentage = Math.min((value / max) * 100, 100)
  const radius = size / 2 - 6
  const center = size / 2
  const circumference = radius * Math.PI
  
  // Calculate the arc for the gauge (half circle from 180 to 360 degrees)
  const startAngle = 180
  const endAngle = 360
  const angleRange = endAngle - startAngle
  const currentAngle = startAngle + (angleRange * percentage / 100)
  
  // Convert angles to radians
  const startRad = (startAngle * Math.PI) / 180
  const endRad = (currentAngle * Math.PI) / 180
  
  // Calculate SVG path
  const startX = center + radius * Math.cos(startRad)
  const startY = center + radius * Math.sin(startRad)
  const endX = center + radius * Math.cos(endRad)
  const endY = center + radius * Math.sin(endRad)
  
  const largeArcFlag = percentage > 50 ? 1 : 0
  
  const pathData = `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`
  
  // Create tick marks
  const ticks = []
  for (let i = 0; i <= 10; i++) {
    const angle = startAngle + (angleRange * i / 10)
    const rad = (angle * Math.PI) / 180
    const innerRadius = radius - 8
    const outerRadius = radius
    const x1 = center + innerRadius * Math.cos(rad)
    const y1 = center + innerRadius * Math.sin(rad)
    const x2 = center + outerRadius * Math.cos(rad)
    const y2 = center + outerRadius * Math.sin(rad)
    ticks.push({ x1, y1, x2, y2 })
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ overflow: 'visible' }}>
          <defs>
            <filter id={`glow-${color}`} x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          
          {/* Background arc */}
          <path
            d={`M ${center - radius} ${center} A ${radius} ${radius} 0 0 1 ${center + radius} ${center}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            strokeLinecap="round"
            className="text-gray-200 dark:text-gray-700"
          />
          
          {/* Progress arc */}
          <path
            d={pathData}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            className="transition-all duration-500 ease-out"
            style={{ 
              filter: `drop-shadow(${color} 0px 0px 4px) drop-shadow(${color} 0px 0px 8px)` 
            }}
          />
          
          {/* Tick marks */}
          {ticks.map((tick, i) => (
            <line
              key={i}
              x1={tick.x1}
              y1={tick.y1}
              x2={tick.x2}
              y2={tick.y2}
              stroke="currentColor"
              strokeWidth="2"
              className="text-gray-400 dark:text-gray-600"
            />
          ))}
        </svg>
        
        {/* Center value */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span 
            className="text-2xl font-bold tabular-nums"
            style={{ 
              color, 
              textShadow: `${color} 0px 0px 6px, ${color} 0px 0px 12px` 
            }}
          >
            {value}
          </span>
          {label && (
            <span className="text-[10px] text-gray-500 dark:text-gray-400 text-center">
              {label}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
