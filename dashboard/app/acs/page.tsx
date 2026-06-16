'use client'

import { useState, useEffect } from 'react'
import { Save, TestTube, Upload, X, FileSpreadsheet } from 'lucide-react'

interface AxirosConfig {
  server_url: string
  base_path: string
  auth_username: string
  auth_password: string
  is_active: boolean
}

export default function ACSPage() {
  const [config, setConfig] = useState<AxirosConfig>({
    server_url: 'https://acs.network.telkomsel.co.id',
    base_path: '/live/AXAPI/Indihome',
    auth_username: 'speed_test',
    auth_password: 'Speed_test.123',
    is_active: true
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState('')

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/axiros-server')
      const data = await res.json()
      if (data) {
        setConfig({
          server_url: data.server_url || '',
          base_path: data.base_path || '/live/AXAPI/Indihome',
          auth_username: data.auth_username || '',
          auth_password: data.auth_password || '',
          is_active: data.is_active !== undefined ? data.is_active : true
        })
      }
    } catch (error) {
      console.error('Failed to fetch config:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    try {
      const res = await fetch('/api/axiros-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })

      if (res.ok) {
        setMessage('Configuration saved successfully!')
      } else {
        setMessage('Failed to save configuration')
      }
    } catch (error) {
      setMessage('Error saving configuration')
    } finally {
      setSaving(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImportFile(file)
      setImportMessage('')
    }
  }

  const handleImport = async () => {
    if (!importFile) {
      setImportMessage('Please select a file to import')
      return
    }

    setImporting(true)
    setImportMessage('')

    try {
      const formData = new FormData()
      formData.append('file', importFile)

      const res = await fetch('/api/ont-devices/import', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()

      if (res.ok) {
        setImportMessage(`Successfully imported ${data.count} devices`)
        setImportFile(null)
      } else {
        setImportMessage(data.error || 'Failed to import devices')
      }
    } catch (error) {
      setImportMessage('Error importing devices')
    } finally {
      setImporting(false)
    }
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
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Axiros Server Configuration</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Axiros Server Configuration Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Server Settings</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Server URL
            </label>
            <input
              type="text"
              value={config.server_url}
              onChange={(e) => setConfig({ ...config, server_url: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="https://acs.network.telkomsel.co.id"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Base Path
            </label>
            <input
              type="text"
              value={config.base_path}
              onChange={(e) => setConfig({ ...config, base_path: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="/live/AXAPI/Indihome"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Auth Username
            </label>
            <input
              type="text"
              value={config.auth_username}
              onChange={(e) => setConfig({ ...config, auth_username: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="speed_test"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Auth Password
            </label>
            <input
              type="password"
              value={config.auth_password}
              onChange={(e) => setConfig({ ...config, auth_password: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Speed_test.123"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              checked={config.is_active}
              onChange={(e) => setConfig({ ...config, is_active: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="is_active" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              Active
            </label>
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
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
            
            <button
              type="button"
              className="flex items-center gap-2 px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <TestTube className="w-4 h-4" />
              Test Connection
            </button>
          </div>
        </form>
        </div>

        {/* Import ONT Devices Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Import ONT Devices</h2>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
              <FileSpreadsheet className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Upload CSV or Excel file containing ONT devices
              </p>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
            {importFile && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Selected: {importFile.name}
              </p>
            )}
            {importMessage && (
              <div className={`p-3 rounded-lg text-sm ${
                importMessage.includes('success') || importMessage.includes('Successfully')
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
              }`}>
                {importMessage}
              </div>
            )}
            <button
              onClick={handleImport}
              disabled={!importFile || importing}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {importing ? 'Importing...' : 'Import Devices'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
