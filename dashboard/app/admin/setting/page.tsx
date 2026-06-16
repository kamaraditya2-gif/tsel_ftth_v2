'use client'

import { useState, useEffect } from 'react'
import { Save, Upload, X, TestTube, FileSpreadsheet, Plus, Trash2, Edit } from 'lucide-react'
import { useRequireAdmin } from '@/hooks/useRequireAdmin'

interface AxirosConfig {
  server_url: string
  base_path: string
  auth_password: string
  is_active: boolean
}

interface TestServer {
  id: number
  name: string
  ip_address: string
  test_type: string
  is_active: boolean
  created_at: string
  created_by: string | null
}

export default function SettingPage() {
  useRequireAdmin()
  
  const [settings, setSettings] = useState({
    app_name: 'Network Performance',
    logo_url: '',
    favicon_url: ''
  })
  const [axirosConfig, setAxirosConfig] = useState<AxirosConfig>({
    server_url: 'https://acs.network.telkomsel.co.id',
    base_path: '/live/AXAPI/Indihome',
    auth_password: 'Speed_test.123',
    is_active: true
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [faviconFile, setFaviconFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState('')
  const [faviconPreview, setFaviconPreview] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingAxiros, setSavingAxiros] = useState(false)
  const [message, setMessage] = useState('')
  const [axirosMessage, setAxirosMessage] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState('')
  const [testServers, setTestServers] = useState<TestServer[]>([])
  const [showAddServer, setShowAddServer] = useState(false)
  const [editingServer, setEditingServer] = useState<TestServer | null>(null)
  const [serverForm, setServerForm] = useState({
    name: '',
    ip_address: '',
    test_type: 'igw',
    is_active: true
  })
  const [savingServer, setSavingServer] = useState(false)
  const [serverMessage, setServerMessage] = useState('')

  useEffect(() => {
    fetchSettings()
    fetchAxirosConfig()
    fetchTestServers()
  }, [])

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/app-settings')
      const data = await res.json()
      setSettings({
        app_name: data.app_name || 'Network Performance',
        logo_url: data.logo_url || '',
        favicon_url: data.favicon_url || ''
      })
      if (data.logo_url) {
        setLogoPreview(data.logo_url)
      }
      if (data.favicon_url) {
        setFaviconPreview(data.favicon_url)
      }
    } catch (error) {
      // Failed to fetch settings - silently ignore
    }
  }

  const fetchAxirosConfig = async () => {
    try {
      const res = await fetch('/api/axiros-server')
      const data = await res.json()
      if (data) {
        setAxirosConfig({
          server_url: data.server_url || '',
          base_path: data.base_path || '/live/AXAPI/Indihome',
          auth_password: data.auth_password || '',
          is_active: data.is_active !== undefined ? data.is_active : true
        })
      }
    } catch (error) {
      console.error('Failed to fetch Axiros config:', error)
    }
  }

  const fetchTestServers = async () => {
    try {
      const res = await fetch('/api/test-server')
      const data = await res.json()
      setTestServers(data)
    } catch (error) {
      console.error('Failed to fetch test servers:', error)
    }
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setLogoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleFaviconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFaviconFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setFaviconPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    try {
      const logoData = logoFile ? await fileToBase64(logoFile) : settings.logo_url
      const faviconData = faviconFile ? await fileToBase64(faviconFile) : settings.favicon_url

      const res = await fetch('/api/app-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_name: settings.app_name,
          logo_url: logoData,
          favicon_url: faviconData
        })
      })

      if (res.ok) {
        setMessage('Settings saved successfully!')
        setLogoFile(null)
        setFaviconFile(null)
      } else {
        setMessage('Failed to save settings')
      }
    } catch (error) {
      setMessage('Error saving settings')
    } finally {
      setSaving(false)
    }
  }

  const handleAxirosSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingAxiros(true)
    setAxirosMessage('')

    try {
      const res = await fetch('/api/axiros-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(axirosConfig)
      })

      if (res.ok) {
        setAxirosMessage('Configuration saved successfully!')
      } else {
        setAxirosMessage('Failed to save configuration')
      }
    } catch (error) {
      setAxirosMessage('Error saving configuration')
    } finally {
      setSavingAxiros(false)
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

  const handleAddServer = () => {
    setShowAddServer(true)
    setEditingServer(null)
    setServerForm({ name: '', ip_address: '', test_type: 'igw', is_active: true })
    setServerMessage('')
  }

  const handleEditServer = (server: TestServer) => {
    setShowAddServer(true)
    setEditingServer(server)
    setServerForm({
      name: server.name,
      ip_address: server.ip_address,
      test_type: server.test_type,
      is_active: server.is_active
    })
    setServerMessage('')
  }

  const handleDeleteServer = async (id: number) => {
    if (!confirm('Are you sure you want to delete this test server?')) {
      return
    }

    try {
      const res = await fetch(`/api/test-server?id=${id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        setTestServers(testServers.filter(s => s.id !== id))
      } else {
        alert('Failed to delete test server')
      }
    } catch (error) {
      console.error('Error deleting test server:', error)
      alert('Error deleting test server')
    }
  }

  const handleServerSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingServer(true)
    setServerMessage('')

    try {
      const url = editingServer ? '/api/test-server' : '/api/test-server'
      const method = editingServer ? 'PUT' : 'POST'
      const body = editingServer
        ? { ...serverForm, id: editingServer.id }
        : { ...serverForm, created_by: 'admin' }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (res.ok) {
        setServerMessage(editingServer ? 'Server updated successfully!' : 'Server added successfully!')
        setShowAddServer(false)
        setEditingServer(null)
        setServerForm({ name: '', ip_address: '', test_type: 'igw', is_active: true })
        fetchTestServers()
      } else {
        setServerMessage('Failed to save server')
      }
    } catch (error) {
      setServerMessage('Error saving server')
    } finally {
      setSavingServer(false)
    }
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = error => reject(error)
    })
  }

  return (
    <div className="min-h-screen p-8 bg-gray-100 dark:bg-gray-900">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Settings</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* App Settings Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Application Settings</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
          {/* App Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Application Name
            </label>
            <input
              type="text"
              value={settings.app_name}
              onChange={(e) => setSettings({ ...settings, app_name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Network Performance"
            />
          </div>

          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Logo
            </label>
            <div className="flex items-center gap-4">
              {logoPreview && (
                <div className="relative">
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="w-16 h-16 object-contain rounded-lg border border-gray-300 dark:border-gray-600"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setLogoPreview('')
                      setLogoFile(null)
                      setSettings({ ...settings, logo_url: '' })
                    }}
                    className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <div className="flex-1">
                <label className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                  <Upload className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {logoFile ? logoFile.name : 'Upload logo'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Favicon Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Favicon
            </label>
            <div className="flex items-center gap-4">
              {faviconPreview && (
                <div className="relative">
                  <img
                    src={faviconPreview}
                    alt="Favicon preview"
                    className="w-8 h-8 object-contain rounded-lg border border-gray-300 dark:border-gray-600"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFaviconPreview('')
                      setFaviconFile(null)
                      setSettings({ ...settings, favicon_url: '' })
                    }}
                    className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <div className="flex-1">
                <label className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                  <Upload className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {faviconFile ? faviconFile.name : 'Upload favicon'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFaviconChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {message && (
            <div className={`p-3 rounded-lg ${message.includes('success') ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'}`}>
              {message}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>

      {/* Axiros Settings Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Axiros Settings</h2>
        <form onSubmit={handleAxirosSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Server URL
            </label>
            <input
              type="text"
              value={axirosConfig.server_url}
              onChange={(e) => setAxirosConfig({ ...axirosConfig, server_url: e.target.value })}
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
              value={axirosConfig.base_path}
              onChange={(e) => setAxirosConfig({ ...axirosConfig, base_path: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="/live/AXAPI/Indihome"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Auth Password
            </label>
            <input
              type="password"
              value={axirosConfig.auth_password}
              onChange={(e) => setAxirosConfig({ ...axirosConfig, auth_password: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Speed_test.123"
            />
          </div>

          {axirosMessage && (
            <div className={`p-3 rounded-lg ${axirosMessage.includes('success') ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'}`}>
              {axirosMessage}
            </div>
          )}

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={savingAxiros}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="w-4 h-4" />
              {savingAxiros ? 'Saving...' : 'Save Configuration'}
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

      {/* Test Server Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Test Servers</h2>
        
        {showAddServer ? (
          <form onSubmit={handleServerSubmit} className="space-y-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Server Name
              </label>
              <input
                type="text"
                value={serverForm.name}
                onChange={(e) => setServerForm({ ...serverForm, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Server name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                IP Address
              </label>
              <input
                type="text"
                value={serverForm.ip_address}
                onChange={(e) => setServerForm({ ...serverForm, ip_address: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="192.168.1.1"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Test Type
              </label>
              <select
                value={serverForm.test_type}
                onChange={(e) => setServerForm({ ...serverForm, test_type: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              >
                <option value="igw">near IGW</option>
                <option value="ebr">near EBR</option>
              </select>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="server_is_active"
                checked={serverForm.is_active}
                onChange={(e) => setServerForm({ ...serverForm, is_active: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="server_is_active" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Active
              </label>
            </div>
            {serverMessage && (
              <div className={`p-3 rounded-lg ${serverMessage.includes('success') ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'}`}>
                {serverMessage}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={savingServer}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-4 h-4" />
                {savingServer ? 'Saving...' : (editingServer ? 'Update' : 'Add')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddServer(false)
                  setEditingServer(null)
                  setServerForm({ name: '', ip_address: '', test_type: 'igw', is_active: true })
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={handleAddServer}
            className="w-full mb-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Test Server
          </button>
        )}

        <div className="space-y-2">
          {testServers.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              No test servers configured
            </p>
          ) : (
            testServers.map((server) => (
              <div key={server.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">{server.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{server.ip_address}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs rounded ${server.test_type === 'igw' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200' : 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-200'}`}>
                    {server.test_type.toUpperCase()}
                  </span>
                  <span className={`px-2 py-1 text-xs rounded ${server.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                    {server.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <button
                    onClick={() => handleEditServer(server)}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteServer(server.id)}
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
  </div>
  )
}
