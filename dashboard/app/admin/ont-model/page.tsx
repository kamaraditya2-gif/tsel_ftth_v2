'use client'

import { useState, useEffect } from 'react'
import { Save, Plus, Trash2, Edit } from 'lucide-react'
import { useRequireAdmin } from '@/hooks/useRequireAdmin'

interface Manufacturer {
  id: number
  name: string
}

interface OntModel {
  id: number
  name: string
  manufacturer_id: number | null
  manufacturer_name?: string
  created_at: string
  created_by: string | null
}

export default function OntModelPage() {
  useRequireAdmin()
  
  const [ontModels, setOntModels] = useState<OntModel[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingOntModel, setEditingOntModel] = useState<OntModel | null>(null)
  const [ontModelForm, setOntModelForm] = useState({
    name: '',
    manufacturer_id: ''
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchOntModels()
    fetchManufacturers()
  }, [])

  const fetchOntModels = async () => {
    try {
      const res = await fetch('/api/ont-model')
      const data = await res.json()
      setOntModels(data)
    } catch (error) {
      console.error('Failed to fetch ONT models:', error)
    }
  }

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
    setEditingOntModel(null)
    setOntModelForm({ name: '', manufacturer_id: '' })
    setMessage('')
  }

  const handleEdit = (ontModel: OntModel) => {
    setShowAddForm(true)
    setEditingOntModel(ontModel)
    setOntModelForm({ 
      name: ontModel.name, 
      manufacturer_id: ontModel.manufacturer_id?.toString() || '' 
    })
    setMessage('')
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this ONT model?')) {
      return
    }

    try {
      const res = await fetch(`/api/ont-model?id=${id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        setOntModels(ontModels.filter(m => m.id !== id))
      } else {
        alert('Failed to delete ONT model')
      }
    } catch (error) {
      console.error('Error deleting ONT model:', error)
      alert('Error deleting ONT model')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    try {
      const url = editingOntModel ? '/api/ont-model' : '/api/ont-model'
      const method = editingOntModel ? 'PUT' : 'POST'
      const body = editingOntModel
        ? { ...ontModelForm, id: editingOntModel.id, manufacturer_id: ontModelForm.manufacturer_id ? parseInt(ontModelForm.manufacturer_id) : null }
        : { ...ontModelForm, manufacturer_id: ontModelForm.manufacturer_id ? parseInt(ontModelForm.manufacturer_id) : null, created_by: 'admin' }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (res.ok) {
        setMessage(editingOntModel ? 'ONT Model updated successfully!' : 'ONT Model added successfully!')
        setShowAddForm(false)
        setEditingOntModel(null)
        setOntModelForm({ name: '', manufacturer_id: '' })
        fetchOntModels()
      } else {
        setMessage('Failed to save ONT model')
      }
    } catch (error) {
      setMessage('Error saving ONT model')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen p-8 bg-gray-100 dark:bg-gray-900">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">ONT Model Management</h1>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        {showAddForm ? (
          <form onSubmit={handleSubmit} className="space-y-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Model Name
              </label>
              <input
                type="text"
                value={ontModelForm.name}
                onChange={(e) => setOntModelForm({ ...ontModelForm, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Model name (e.g., F670L)"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Manufacturer
              </label>
              <select
                value={ontModelForm.manufacturer_id}
                onChange={(e) => setOntModelForm({ ...ontModelForm, manufacturer_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select Manufacturer</option>
                {manufacturers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
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
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : (editingOntModel ? 'Update' : 'Add')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false)
                  setEditingOntModel(null)
                  setOntModelForm({ name: '', manufacturer_id: '' })
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
            Add ONT Model
          </button>
        )}

        <div className="space-y-2">
          {ontModels.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              No ONT models found
            </p>
          ) : (
            ontModels.map((ontModel) => (
              <div key={ontModel.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">{ontModel.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Manufacturer: {ontModel.manufacturer_name || 'Not assigned'}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Created: {new Date(ontModel.created_at).toLocaleDateString()} by {ontModel.created_by || 'Unknown'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(ontModel)}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(ontModel.id)}
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
