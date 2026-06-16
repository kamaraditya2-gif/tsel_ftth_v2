'use client'

import { useState, useEffect } from 'react'

export default function AnimatedBackground() {
  const [nodes, setNodes] = useState<Array<{ id: number; x: number; y: number; vx: number; vy: number }>>([])
  const [connections, setConnections] = useState<Array<{ from: number; to: number }>>([])

  useEffect(() => {
    const newNodes = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
    }))
    setNodes(newNodes)

    const newConnections: Array<{ from: number; to: number }> = []
    for (let i = 0; i < newNodes.length; i++) {
      for (let j = i + 1; j < newNodes.length; j++) {
        const dx = newNodes[i].x - newNodes[j].x
        const dy = newNodes[i].y - newNodes[j].y
        const distance = Math.sqrt(dx * dx + dy * dy)
        if (distance < 25) {
          newConnections.push({ from: i, to: j })
        }
      }
    }
    setConnections(newConnections)

    const interval = setInterval(() => {
      setNodes(prev => {
        const updated = prev.map(node => ({
          ...node,
          x: (node.x + node.vx + 100) % 100,
          y: (node.y + node.vy + 100) % 100,
        }))

        const newConns: Array<{ from: number; to: number }> = []
        for (let i = 0; i < updated.length; i++) {
          for (let j = i + 1; j < updated.length; j++) {
            const dx = updated[i].x - updated[j].x
            const dy = updated[i].y - updated[j].y
            const distance = Math.sqrt(dx * dx + dy * dy)
            if (distance < 25) {
              newConns.push({ from: i, to: j })
            }
          }
        }
        setConnections(newConns)
        return updated
      })
    }, 50)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed inset-0 -z-10 bg-gradient-to-b from-slate-900 via-blue-900 to-cyan-900">
      <svg className="absolute inset-0 w-full h-full">
        {/* Connections */}
        {connections.map((conn, index) => {
          const fromNode = nodes[conn.from]
          const toNode = nodes[conn.to]
          if (!fromNode || !toNode) return null
          return (
            <line
              key={index}
              x1={`${fromNode.x}%`}
              y1={`${fromNode.y}%`}
              x2={`${toNode.x}%`}
              y2={`${toNode.y}%`}
              stroke="rgba(59, 130, 246, 0.2)"
              strokeWidth="1"
            />
          )
        })}
        {/* Nodes */}
        {nodes.map((node, index) => (
          <circle
            key={node.id}
            cx={`${node.x}%`}
            cy={`${node.y}%`}
            r="6"
            fill="rgba(59, 130, 246, 0.4)"
            className="animate-pulse"
            style={{
              animationDuration: `${1 + Math.random()}s`,
            }}
          />
        ))}
      </svg>
    </div>
  )
}
