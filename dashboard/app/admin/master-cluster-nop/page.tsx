'use client'

import { useState, useEffect } from 'react'
import { Save, Plus, Trash2, Edit, X } from 'lucide-react'
import { useRequireAdmin } from '@/hooks/useRequireAdmin'

interface MasterClusterNop {
  id: number
  name: string
  code: string
  regional_id: number | null
  area_id: number | null
  created_at: string
  regional_name?: string
  area_name?: string
}

interface DownstreamServer {
  id: number
  name: string
}

interface MasterArea {
  id: number
  name: string
}

export default function MasterClusterNopPage() {
  useRequireAdmin()

  const [items, setItems] = useState<MasterClusterNop[]>([])
  const [regionals, setRegionals] = useState<DownstreamServer[]>([])
  const [areas, setAreas] = useState<MasterArea[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<MasterClusterNop | null>(null)
  const [form, setForm] = useState({ name: '', code: '', regional_id: '', area_id: '' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchItems()
    fetchDropdowns()
  }, [])

  const fetchItems = async () => {
    try {
      const res = await fetch('/api/master-cluster-nop')
      const data = await res.json()
      setItems(data)
    } catch {
      console.error('Failed to fetch master cluster nop')
    }
  }

  const fetchDropdowns = async () => {
    try {
      const [regRes, areaRes] = await Promise.all([
        fetch('/api/downstream-servers'),
        fetch('/api/master-area')
      ])
      if (regRes.ok) setRegionals(await regRes.json())
      if (areaRes.ok) setAreas(await areaRes.json())
    } catch {
      console.error('Failed to fetch dropdown data')
    }
  }

  const openAdd = () => {
    setEditingItem(null)
    setForm({ name: '', code: '', regional_id: '', area_id: '' })
    setMessage('')
    setShowModal(true)
  }

  const openEdit = (item: MasterClusterNop) => {
    setEditingItem(item)
    setForm({
      name: item.name,
      code: item.code,
      regional_id: item.regional_id?.toString() || '',
      area_id: item.area_id?.toString() || ''
    })
    setMessage('')
    setShowModal(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this cluster NOP?')) return
    try {
      const res = await fetch(`/api/master-cluster-nop/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setItems(items.filter(i => i.id !== id))
      } else {
        alert('Failed to delete cluster NOP')
      }
    } catch {
      alert('Error deleting cluster NOP')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    const payload: Record<string, unknown> = {
      name: form.name,
      code: form.code
    }
    if (form.regional_id) payload.regional_id = Number(form.regional_id)
    if (form.area_id) payload.area_id = Number(form.area_id)

    try {
      const method = editingItem ? 'PUT' : 'POST'
      const url = editingItem ? `/api/master-cluster-nop/${editingItem.id}` : '/api/master-cluster-nop'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        setMessage(editingItem ? 'Cluster NOP updated successfully!' : 'Cluster NOP added successfully!')
        setShowModal(false)
        setEditingItem(null)
        setForm({ name: '', code: '', regional_id: '', area_id: '' })
        fetchItems()
      } else {
        setMessage('Failed to save cluster NOP')
      }
    } catch {
      setMessage('Error saving cluster NOP')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen p-8 bg-gray-100 dark:bg-gray-900">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Master Cluster NOP Management</h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <button
          onClick={openAdd}
          className="w-full mb-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Cluster NOP
        </button>

        {items.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No cluster NOPs found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Name</th>
                  <th className="pb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Code</th>
                  <th className="pb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Regional</th>
                  <th className="pb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Area</th>
                  <th className="pb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Created At</th>
                  <th className="pb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="py-3 text-gray-900 dark:text-white">{item.name}</td>
                    <td className="py-3 text-gray-900 dark:text-white">{item.code}</td>
                    <td className="py-3 text-gray-900 dark:text-white">{item.regional_name || '-'}</td>
                    <td className="py-3 text-gray-900 dark:text-white">{item.area_name || '-'}</td>
                    <td className="py-3 text-sm text-gray-500 dark:text-gray-400">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(item)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingItem ? 'Edit Cluster NOP' : 'Add Cluster NOP'}
              </h2>
              <button onClick={() => { setShowModal(false); setEditingItem(null); }} className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Code</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Regional</label>
                <select
                  value={form.regional_id}
                  onChange={e => setForm({ ...form, regional_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select Regional</option>
                  {regionals.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Area</label>
                <select
                  value={form.area_id}
                  onChange={e => setForm({ ...form, area_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select Area</option>
                  {areas.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              {message && (
                <div className={`p-3 rounded-lg ${message.includes('success') ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'}`}>
                  {message}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : (editingItem ? 'Update' : 'Add')}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingItem(null); }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
