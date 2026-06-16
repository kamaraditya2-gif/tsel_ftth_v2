'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, FileCode, Eye, X, Copy, Check, Edit } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'

interface Payload {
  id: number
  name: string
  method: string
  endpoint: string
  parameters: any
  headers: any
  description: string
  created_at: string
}

export default function AxirosPayloadsPage() {
  const [payloads, setPayloads] = useState<Payload[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    method: 'POST',
    endpoint: '',
    parameters: '',
    headers: '',
    description: ''
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; payloadId: number | null }>({ isOpen: false, payloadId: null })
  const [viewDialog, setViewDialog] = useState<{ isOpen: boolean; payload: Payload | null }>({ isOpen: false, payload: null })
  const [copied, setCopied] = useState(false)
  const [axirosConfig, setAxirosConfig] = useState<any>(null)
  const [editingId, setEditingId] = useState<number | null>(null)

  useEffect(() => {
    fetchPayloads()
    fetchAxirosConfig()
  }, [])

  const fetchAxirosConfig = async () => {
    try {
      const res = await fetch('/api/axiros-server')
      const data = await res.json()
      setAxirosConfig(data)
    } catch (error) {
      console.error('Failed to fetch axiros config:', error)
    }
  }

  const fetchPayloads = async () => {
    try {
      const res = await fetch('/api/payloads')
      const data = await res.json()
      setPayloads(data)
    } catch (error) {
      console.error('Failed to fetch payloads:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    try {
      const parametersObj = formData.parameters ? JSON.parse(formData.parameters) : {}
      const headersObj = formData.headers ? JSON.parse(formData.headers) : {}

      const res = await fetch('/api/payloads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          parameters: parametersObj,
          headers: headersObj
        })
      })

      if (res.ok) {
        setMessage('Payload added successfully!')
        setFormData({
          name: '',
          method: 'POST',
          endpoint: '',
          parameters: '',
          headers: '',
          description: ''
        })
        setShowForm(false)
        fetchPayloads()
      } else {
        setMessage('Failed to add payload')
      }
    } catch (error) {
      setMessage('Error adding payload')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    setDeleteDialog({ isOpen: true, payloadId: id })
  }

  const confirmDelete = async () => {
    if (deleteDialog.payloadId === null) return

    try {
      const res = await fetch(`/api/payloads?id=${deleteDialog.payloadId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        fetchPayloads()
      }
    } catch (error) {
      console.error('Failed to delete payload:', error)
    } finally {
      setDeleteDialog({ isOpen: false, payloadId: null })
    }
  }

  const handleView = (payload: Payload) => {
    setViewDialog({ isOpen: true, payload })
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setFormData({
      name: '',
      method: 'POST',
      endpoint: '',
      parameters: '',
      headers: '',
      description: ''
    })
    setShowForm(false)
  }

  const handleEdit = (payload: Payload) => {
    setEditingId(payload.id)
    setFormData({
      name: payload.name,
      method: payload.method,
      endpoint: payload.endpoint,
      parameters: JSON.stringify(payload.parameters || {}, null, 2),
      headers: JSON.stringify(payload.headers || {}, null, 2),
      description: payload.description
    })
    setShowForm(true)
  }

  const generateCurlCommand = (payload: Payload): string => {
    const method = payload.method.toUpperCase()
    const endpoint = payload.endpoint
    const parameters = payload.parameters
    const headers = payload.headers

    // Construct full URL from Axiros Server config
    let fullUrl = endpoint
    if (axirosConfig && axirosConfig.server_url && axirosConfig.base_path) {
      fullUrl = `${axirosConfig.server_url}${axirosConfig.base_path}${endpoint}`
    }

    let curlCmd = `curl -X '${method}' '${fullUrl}'`

    // Add standard headers with backslash for multiline
    curlCmd += ` \\\n  -H 'accept: application/json'`
    curlCmd += ` \\\n  -H 'Content-Type: application/json'`

    // Add Authorization header from Axiros Server config
    if (axirosConfig && axirosConfig.auth_username && axirosConfig.auth_password) {
      const auth = Buffer.from(`${axirosConfig.auth_username}:${axirosConfig.auth_password}`).toString('base64')
      curlCmd += ` \\\n  -H "Authorization: Basic ${auth}"`
    }

    // Add custom headers (skip standard ones)
    const standardHeaders = ['accept', 'content-type', 'authorization']
    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        if (!standardHeaders.includes(key.toLowerCase())) {
          curlCmd += ` \\\n  -H '${key}: ${value}'`
        }
      })
    }

    if (parameters && Object.keys(parameters).length > 0) {
      curlCmd += ` \\\n  -d '${JSON.stringify(parameters)}'`
    }

    return curlCmd
  }

  const handleCopyCurl = async (curlCmd: string) => {
    await navigator.clipboard.writeText(curlCmd)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8 bg-gray-100 dark:bg-gray-900">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-8"></div>
          <div className="h-64 bg-white dark:bg-gray-800 rounded-lg"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8 bg-gray-100 dark:bg-gray-900">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Axiros Payloads</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Payload
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">{editingId ? 'Edit Payload' : 'Add New Payload'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Payload Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Ping"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Method
                </label>
                <select
                  value={formData.method}
                  onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Endpoint
              </label>
              <input
                type="text"
                value={formData.endpoint}
                onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="/rest/2.0/devices/"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Parameters (JSON)
              </label>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-2">
                <p className="text-xs text-blue-800 dark:text-blue-300 mb-2">Available variables (use in curly braces):</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded text-blue-600 dark:text-blue-400">{"{cpe_id}"}</code>
                  <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded text-blue-600 dark:text-blue-400">{"{serial_number}"}</code>
                  <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded text-blue-600 dark:text-blue-400">{"{mac_address}"}</code>
                  <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded text-blue-600 dark:text-blue-400">{"{ip_address}"}</code>
                  <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded text-blue-600 dark:text-blue-400">{"{device_name}"}</code>
                  <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded text-blue-600 dark:text-blue-400">{"{group_id}"}</code>
                </div>
              </div>
              <textarea
                value={formData.parameters}
                onChange={(e) => setFormData({ ...formData, parameters: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
                rows={4}
                placeholder='{"cpe_id": "{serial_number}", "service_id": ""}'
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Headers (JSON)
              </label>
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-2">
                <p className="text-xs text-green-800 dark:text-green-300">
                  <strong>Note:</strong> Authorization header will be auto-generated from Axiros Server settings. You can leave it empty or add custom headers.
                </p>
              </div>
              <textarea
                value={formData.headers}
                onChange={(e) => setFormData({ ...formData, headers: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
                rows={3}
                placeholder='{"accept": "application/json"}'
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                rows={2}
                placeholder="Description of this payload"
              />
            </div>

            {message && (
              <div className={`p-4 rounded-lg ${message.includes('success') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {message}
              </div>
            )}

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving...' : (editingId ? 'Update Payload' : 'Save Payload')}
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Payload List</h2>
          {payloads.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No payloads found. Click "Add Payload" to create one.</p>
          ) : (
            <div className="space-y-4">
              {payloads.map((payload) => (
                <div key={payload.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                        <FileCode className="w-6 h-6 text-blue-600 dark:text-blue-300" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{payload.name}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{payload.description}</p>
                        <div className="space-y-1 text-sm">
                          <p className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded inline-block"><span className="font-medium text-gray-700 dark:text-gray-300">Method:</span> <span className="text-purple-600 dark:text-purple-400 font-semibold">{payload.method}</span></p>
                          <p className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded inline-block"><span className="font-medium text-gray-700 dark:text-gray-300">Endpoint:</span> <span className="text-blue-600 dark:text-blue-400 font-mono">{payload.endpoint}</span></p>
                          {payload.parameters && Object.keys(payload.parameters).length > 0 && (
                            <p className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded inline-block"><span className="font-medium text-gray-700 dark:text-gray-300">Parameters:</span> <span className="text-cyan-600 dark:text-cyan-400 font-mono">{JSON.stringify(payload.parameters)}</span></p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(payload)}
                        className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleView(payload)}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(payload.id)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, payloadId: null })}
        onConfirm={confirmDelete}
        title="Delete Payload"
        message="Are you sure you want to delete this payload? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
      />

      {viewDialog.isOpen && viewDialog.payload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">View Payload as cURL</h3>
                <button
                  onClick={() => setViewDialog({ isOpen: false, payload: null })}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
              <div className="bg-slate-800 dark:bg-slate-900 rounded-lg p-4 mb-4 overflow-x-auto">
                <pre className="text-cyan-400 text-sm font-mono whitespace-pre-wrap">
                  {generateCurlCommand(viewDialog.payload)}
                </pre>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setViewDialog({ isOpen: false, payload: null })}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => viewDialog.payload && handleCopyCurl(generateCurlCommand(viewDialog.payload))}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
