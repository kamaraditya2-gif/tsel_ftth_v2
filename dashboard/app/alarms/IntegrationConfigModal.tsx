'use client'

import { useState, useEffect } from 'react'
import { X, Send, MessageCircle, Ticket, TestTube } from 'lucide-react'

interface IntegrationConfigModalProps {
  isOpen: boolean
  onClose: () => void
  integration: any
  onSave: (platform: string, status: string, config: any) => Promise<void>
}

export default function IntegrationConfigModal({ isOpen, onClose, integration, onSave }: IntegrationConfigModalProps) {
  const [config, setConfig] = useState<Record<string, any>>({})
  const [status, setStatus] = useState('inactive')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  useEffect(() => {
    if (integration) {
      setConfig(integration.config || {})
      setStatus(integration.status || 'inactive')
      setTestResult(null)
    }
  }, [integration])

  if (!isOpen || !integration) return null

  const platform = integration.platform

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(platform, status, config)
      onClose()
    } catch (err) {
      console.error('Save error:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/integrations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, config }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setTestResult('success')
      } else {
        setTestResult(data.error || 'Test failed')
      }
    } catch (err: any) {
      setTestResult(err.message || 'Test failed')
    } finally {
      setTesting(false)
    }
  }

  const updateField = (key: string, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  const iconMap: Record<string, any> = {
    telegram: Send,
    whatsapp: MessageCircle,
    ticketing: Ticket,
  }
  const Icon = iconMap[platform] || Send

  const titleMap: Record<string, string> = {
    telegram: 'Konfigurasi Telegram Bot',
    whatsapp: 'Konfigurasi WhatsApp API',
    ticketing: 'Konfigurasi Ticketing System',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-lg w-full mx-4">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
              <Icon className="w-5 h-5 text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold text-white">{titleMap[platform]}</h3>
            <button
              onClick={onClose}
              className="ml-auto p-1 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Status Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
              <span className="text-sm text-gray-300">Status Integrasi</span>
              <button
                onClick={() => setStatus(status === 'active' ? 'inactive' : 'active')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  status === 'active' ? 'bg-emerald-500' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    status === 'active' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Telegram Fields */}
            {platform === 'telegram' && (
              <>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Bot Token</label>
                  <input
                    type="text"
                    value={config.bot_token || ''}
                    onChange={(e) => updateField('bot_token', e.target.value)}
                    placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-gray-200 text-sm focus:outline-none focus:border-emerald-500/50 placeholder-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Chat ID</label>
                  <input
                    type="text"
                    value={config.chat_id || ''}
                    onChange={(e) => updateField('chat_id', e.target.value)}
                    placeholder="-1001234567890 atau 123456789"
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-gray-200 text-sm focus:outline-none focus:border-emerald-500/50 placeholder-gray-600"
                  />
                </div>
              </>
            )}

            {/* WhatsApp Fields */}
            {platform === 'whatsapp' && (
              <>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">API URL</label>
                  <input
                    type="text"
                    value={config.api_url || ''}
                    onChange={(e) => updateField('api_url', e.target.value)}
                    placeholder="https://api.fonnte.com/send"
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-gray-200 text-sm focus:outline-none focus:border-emerald-500/50 placeholder-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">API Key / Authorization</label>
                  <input
                    type="text"
                    value={config.api_key || ''}
                    onChange={(e) => updateField('api_key', e.target.value)}
                    placeholder="Bearer token atau API key"
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-gray-200 text-sm focus:outline-none focus:border-emerald-500/50 placeholder-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Target Number (opsional)</label>
                  <input
                    type="text"
                    value={config.target_number || ''}
                    onChange={(e) => updateField('target_number', e.target.value)}
                    placeholder="6281234567890"
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-gray-200 text-sm focus:outline-none focus:border-emerald-500/50 placeholder-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Custom Headers (JSON, opsional)</label>
                  <textarea
                    value={config.headers ? JSON.stringify(config.headers, null, 2) : ''}
                    onChange={(e) => {
                      try {
                        const val = e.target.value.trim() ? JSON.parse(e.target.value) : {}
                        updateField('headers', val)
                      } catch {
                        updateField('headers', e.target.value)
                      }
                    }}
                    placeholder='{"X-Custom-Header": "value"}'
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-gray-200 text-sm focus:outline-none focus:border-emerald-500/50 placeholder-gray-600 font-mono"
                  />
                </div>
              </>
            )}

            {/* Ticketing Fields */}
            {platform === 'ticketing' && (
              <>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Ticketing API URL</label>
                  <input
                    type="text"
                    value={config.api_url || ''}
                    onChange={(e) => updateField('api_url', e.target.value)}
                    placeholder="https://ticketing.example.com/api/v1/tickets"
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-gray-200 text-sm focus:outline-none focus:border-emerald-500/50 placeholder-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">API Key / Authorization</label>
                  <input
                    type="text"
                    value={config.api_key || ''}
                    onChange={(e) => updateField('api_key', e.target.value)}
                    placeholder="Bearer token atau API key"
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-gray-200 text-sm focus:outline-none focus:border-emerald-500/50 placeholder-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Custom Headers (JSON, opsional)</label>
                  <textarea
                    value={config.headers ? JSON.stringify(config.headers, null, 2) : ''}
                    onChange={(e) => {
                      try {
                        const val = e.target.value.trim() ? JSON.parse(e.target.value) : {}
                        updateField('headers', val)
                      } catch {
                        updateField('headers', e.target.value)
                      }
                    }}
                    placeholder='{"X-Custom-Header": "value"}'
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-gray-200 text-sm focus:outline-none focus:border-emerald-500/50 placeholder-gray-600 font-mono"
                  />
                </div>
              </>
            )}

            {testResult && (
              <div className={`p-3 rounded-lg text-sm ${
                testResult === 'success' 
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' 
                  : 'bg-red-500/10 text-red-300 border border-red-500/20'
              }`}>
                {testResult === 'success' ? '✅ Koneksi berhasil!' : `❌ ${testResult}`}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-gray-300 hover:bg-slate-700 transition-colors text-sm"
            >
              Batal
            </button>
            <button
              onClick={handleTest}
              disabled={testing || status !== 'active'}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-gray-300 hover:bg-slate-700 transition-colors text-sm disabled:opacity-50"
            >
              <TestTube className="w-4 h-4" />
              {testing ? 'Testing...' : 'Test'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors text-sm disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
