'use client'

import { useState, useRef, useEffect } from 'react'

interface InlineAliasProps {
  deviceId: number
  value: string
  onSave: () => void
}

export default function InlineAlias({ deviceId, value, onSave }: InlineAliasProps) {
  const [editing, setEditing] = useState(false)
  const [alias, setAlias] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus()
  }, [editing])

  const save = async () => {
    setEditing(false)
    if (alias === value) return
    try {
      await fetch(`/api/devices/${deviceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias_device: alias || null })
      })
      onSave()
    } catch (e) {
      console.error('Failed to save alias:', e)
      setAlias(value)
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={alias}
        onChange={(e) => setAlias(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setAlias(value); setEditing(false) } }}
        className="w-full px-2 py-1 bg-slate-700 border border-blue-500 rounded text-white text-sm focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      />
    )
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className="cursor-pointer px-2 py-1 rounded hover:bg-slate-700/50 text-sm text-gray-300 min-w-[60px] inline-block"
      title="Click to edit"
    >
      {alias || <span className="text-gray-500 italic">—</span>}
    </span>
  )
}