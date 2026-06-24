'use client'

import { useState, useEffect } from 'react'
import { Save, Plus, Trash2, Edit, X } from 'lucide-react'
import { useRequireAdmin } from '@/hooks/useRequireAdmin'

interface Threshold {
  id: number
  category: string
  alarm_name: string
  profile: string | null
  brand: string | null
  ont_type: string | null
  threshold_type: string
  warning_value: number
  critical_value: number
  unit: string
  status: string
  effective_date: string
  created_at: string
}

const CATEGORIES = ['Performance', 'Throughput', 'Capacity', 'Hardware', 'Availability']
const THRESHOLD_TYPES = ['UPPER', 'LOWER']
const STATUSES = ['active', 'inactive']

const emptyForm = {
  category: '',
  alarm_name: '',
  profile: '',
  brand: '',
  ont_type: '',
  threshold_type: 'UPPER',
  warning_value: '',
  critical_value: '',
  unit: '',
  status: 'active',
  effective_date: ''
}

export default function ThresholdPage() {
  useRequireAdmin()

  const [items, setItems] = useState<Threshold[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<Threshold | null>(null)
  const [form, setForm] = useState<Record<string, string>>({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  useEffect(() => {
    fetchItems()
  }, [])

  const fetchItems = async () => {
    try {
      const res = await fetch('/api/admin/threshold')
      const data = await res.json()
      if (Array.isArray(data)) {
        setItems(data)
      } else if (data.data) {
        setItems(data.data)
      } else {
        console.error('Unexpected response:', data)
        setItems([])
      }
      setItems(data)
    } catch {
      console.error('Failed to fetch thresholds')
    }
  }

  const openAdd = () => {
    setEditingItem(null)
    setForm({ ...emptyForm })
    setMessage('')
    setShowModal(true)
  }

  const openEdit = (item: Threshold) => {
    setEditingItem(item)
    setForm({
      category: item.category,
      alarm_name: item.alarm_name,
      profile: item.profile || '',
      brand: item.brand || '',
      ont_type: item.ont_type || '',
      threshold_type: item.threshold_type,
      warning_value: String(item.warning_value),
      critical_value: String(item.critical_value),
      unit: item.unit,
      status: item.status,
      effective_date: item.effective_date ? item.effective_date.slice(0, 10) : ''
    })
    setMessage('')
    setShowModal(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this threshold?')) return
    try {
      const res = await fetch(`/api/admin/threshold/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setItems(items.filter(i => i.id !== id))
      } else {
        alert('Failed to delete threshold')
      }
    } catch {
      alert('Error deleting threshold')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    const payload: Record<string, unknown> = {
      category: form.category,
      alarm_name: form.alarm_name,
      threshold_type: form.threshold_type,
      warning_value: Number(form.warning_value),
      critical_value: Number(form.critical_value),
      unit: form.unit,
      status: form.status
    }
    if (form.profile) payload.profile = form.profile
    if (form.brand) payload.brand = form.brand
    if (form.ont_type) payload.ont_type = form.ont_type
    if (form.effective_date) payload.effective_date = form.effective_date

    try {
      const method = editingItem ? 'PUT' : 'POST'
      const url = editingItem ? `/api/admin/threshold/${editingItem.id}` : '/api/admin/threshold'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        setMessage(editingItem ? 'Threshold updated successfully!' : 'Threshold added successfully!')
        setShowModal(false)
        setEditingItem(null)
        setForm({ ...emptyForm })
        fetchItems()
      } else {
        setMessage('Failed to save threshold')
      }
    } catch {
      setMessage('Error saving threshold')
    } finally {
      setSaving(false)
    }
  }

  const filteredItems = items.filter(item => {
    if (filterCategory && item.category !== filterCategory) return false
    if (filterStatus && item.status !== filterStatus) return false
    return true
  })

  return (
    <div className="min-h-screen p-8 bg-gray-100 dark:bg-gray-900">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Threshold Management</h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="">All Statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <button
            onClick={openAdd}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Threshold
          </button>
        </div>

        {filteredItems.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No thresholds found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-3 text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">Category</th>
                  <th className="pb-3 text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">Alarm Name</th>
                  <th className="pb-3 text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">Profile</th>
                  <th className="pb-3 text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">Brand</th>
                  <th className="pb-3 text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">ONT Type</th>
                  <th className="pb-3 text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">Type</th>
                  <th className="pb-3 text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">Warning</th>
                  <th className="pb-3 text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">Critical</th>
                  <th className="pb-3 text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">Unit</th>
                  <th className="pb-3 text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">Status</th>
                  <th className="pb-3 text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">Effective</th>
                  <th className="pb-3 text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => (
                  <tr key={item.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="py-3 text-gray-900 dark:text-white whitespace-nowrap">{item.category}</td>
                    <td className="py-3 text-gray-900 dark:text-white whitespace-nowrap">{item.alarm_name}</td>
                    <td className="py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{item.profile || '-'}</td>
                    <td className="py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{item.brand || '-'}</td>
                    <td className="py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{item.ont_type || '-'}</td>
                    <td className="py-3 text-gray-900 dark:text-white whitespace-nowrap">{item.threshold_type}</td>
                    <td className="py-3 text-gray-900 dark:text-white whitespace-nowrap">{item.warning_value}</td>
                    <td className="py-3 text-gray-900 dark:text-white whitespace-nowrap">{item.critical_value}</td>
                    <td className="py-3 text-gray-900 dark:text-white whitespace-nowrap">{item.unit}</td>
                    <td className="py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${item.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {item.effective_date ? new Date(item.effective_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="py-3 whitespace-nowrap">
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingItem ? 'Edit Threshold' : 'Add Threshold'}
              </h2>
              <button onClick={() => { setShowModal(false); setEditingItem(null); }} className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Category</label>
                  <select
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  >
                    <option value="">Select Category</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Alarm Name</label>
                  <input
                    type="text"
                    value={form.alarm_name}
                    onChange={e => setForm({ ...form, alarm_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Profile</label>
                  <input
                    type="text"
                    value={form.profile}
                    onChange={e => setForm({ ...form, profile: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Brand</label>
                  <input
                    type="text"
                    value={form.brand}
                    onChange={e => setForm({ ...form, brand: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">ONT Type</label>
                  <input
                    type="text"
                    value={form.ont_type}
                    onChange={e => setForm({ ...form, ont_type: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Threshold Type</label>
                  <select
                    value={form.threshold_type}
                    onChange={e => setForm({ ...form, threshold_type: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  >
                    {THRESHOLD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Warning Value</label>
                  <input
                    type="number"
                    step="any"
                    value={form.warning_value}
                    onChange={e => setForm({ ...form, warning_value: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Critical Value</label>
                  <input
                    type="number"
                    step="any"
                    value={form.critical_value}
                    onChange={e => setForm({ ...form, critical_value: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Unit</label>
                  <input
                    type="text"
                    value={form.unit}
                    onChange={e => setForm({ ...form, unit: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Effective Date</label>
                  <input
                    type="date"
                    value={form.effective_date}
                    onChange={e => setForm({ ...form, effective_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
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
