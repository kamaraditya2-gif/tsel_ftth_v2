'use client'

import { useState, useEffect } from 'react'
import { Save, Plus, Trash2, Edit } from 'lucide-react'
import { useRequireAdmin } from '@/hooks/useRequireAdmin'

interface Manufacturer {
  id: number
  name: string
  created_at: string
  created_by: string | null
}

export default function ManufacturerPage() {
  useRequireAdmin()
  
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingManufacturer, setEditingManufacturer] = useState<Manufacturer | null>(null)
  const [manufacturerForm, setManufacturerForm] = useState({
    name: ''
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchManufacturers()
  }, [])

  const fetchManufacturers = async () => {
    try {
      const res = await fetch('/api/manufacturer')
      const data = await res.json()
      setManufacturers(data)
    } catch (error) {
      console.error('Failed to fetch manufacturers:', error)
    }
  }

  const handleAdd = () => {
    setShowAddForm(true)
    setEditingManufacturer(null)
    setManufacturerForm({ name: '' })
    setMessage('')
  }

  const handleEdit = (manufacturer: Manufacturer) => {
    setShowAddForm(true)
    setEditingManufacturer(manufacturer)
    setManufacturerForm({ name: manufacturer.name })
    setMessage('')
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this manufacturer?')) {
      return
    }

    try {
      const res = await fetch(`/api/manufacturer?id=${id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        setManufacturers(manufacturers.filter(m => m.id !== id))
      } else {
        alert('Failed to delete manufacturer')
      }
    } catch (error) {
      console.error('Error deleting manufacturer:', error)
      alert('Error deleting manufacturer')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    try {
      const url = editingManufacturer ? '/api/manufacturer' : '/api/manufacturer'
      const method = editingManufacturer ? 'PUT' : 'POST'
      const body = editingManufacturer
        ? { ...manufacturerForm, id: editingManufacturer.id }
        : { ...manufacturerForm, created_by: 'admin' }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (res.ok) {
        setMessage(editingManufacturer ? 'Manufacturer updated successfully!' : 'Manufacturer added successfully!')
        setShowAddForm(false)
        setEditingManufacturer(null)
        setManufacturerForm({ name: '' })
        fetchManufacturers()
      } else {
        setMessage('Failed to save manufacturer')
      }
    } catch (error) {
      setMessage('Error saving manufacturer')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen p-8 bg-gray-100 dark:bg-gray-900">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Manufacturer Management</h1>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        {showAddForm ? (
          <form onSubmit={handleSubmit} className="space-y-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Manufacturer Name
              </label>
              <input
                type="text"
                value={manufacturerForm.name}
                onChange={(e) => setManufacturerForm({ ...manufacturerForm, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Manufacturer name"
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
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : (editingManufacturer ? 'Update' : 'Add')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false)
                  setEditingManufacturer(null)
                  setManufacturerForm({ name: '' })
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={handleAdd}
            className="w-full mb-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Manufacturer
          </button>
        )}

        <div className="space-y-2">
          {manufacturers.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              No manufacturers found
            </p>
          ) : (
            manufacturers.map((manufacturer) => (
              <div key={manufacturer.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">{manufacturer.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Created: {new Date(manufacturer.created_at).toLocaleDateString()} by {manufacturer.created_by || 'Unknown'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(manufacturer)}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(manufacturer.id)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
