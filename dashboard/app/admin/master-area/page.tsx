'use client'

import { useState, useEffect } from 'react'
import { Save, Plus, Trash2, Edit, X } from 'lucide-react'
import { useRequireAdmin } from '@/hooks/useRequireAdmin'

interface MasterArea {
  id: number
  name: string
  code: string
  created_at: string
}

export default function MasterAreaPage() {
  useRequireAdmin()

  const [items, setItems] = useState<MasterArea[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<MasterArea | null>(null)
  const [form, setForm] = useState({ name: '', code: '' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchItems()
  }, [])

  const fetchItems = async () => {
    try {
      const res = await fetch('/api/master-area')
      const data = await res.json()
      setItems(data)
    } catch {
      console.error('Failed to fetch master areas')
    }
  }

  const openAdd = () => {
    setEditingItem(null)
    setForm({ name: '', code: '' })
    setMessage('')
    setShowModal(true)
  }

  const openEdit = (item: MasterArea) => {
    setEditingItem(item)
    setForm({ name: item.name, code: item.code })
    setMessage('')
    setShowModal(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this master area?')) return
    try {
      const res = await fetch(`/api/master-area/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setItems(items.filter(i => i.id !== id))
      } else {
        alert('Failed to delete master area')
      }
    } catch {
      alert('Error deleting master area')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    try {
      const method = editingItem ? 'PUT' : 'POST'
      const url = editingItem ? `/api/master-area/${editingItem.id}` : '/api/master-area'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })

      if (res.ok) {
        setMessage(editingItem ? 'Master area updated successfully!' : 'Master area added successfully!')
        setShowModal(false)
        setEditingItem(null)
        setForm({ name: '', code: '' })
        fetchItems()
      } else {
        setMessage('Failed to save master area')
      }
    } catch {
      setMessage('Error saving master area')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen p-8 bg-gray-100 dark:bg-gray-900">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Master Area Management</h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <button
          onClick={openAdd}
          className="w-full mb-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Master Area
        </button>

        {items.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No master areas found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Name</th>
                  <th className="pb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Code</th>
                  <th className="pb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Created At</th>
                  <th className="pb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="py-3 text-gray-900 dark:text-white">{item.name}</td>
                    <td className="py-3 text-gray-900 dark:text-white">{item.code}</td>
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
                {editingItem ? 'Edit Master Area' : 'Add Master Area'}
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
