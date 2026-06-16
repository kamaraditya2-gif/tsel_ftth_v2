'use client'

import { useState, useEffect, useRef } from 'react'
import { Database, Trash2, RefreshCw, AlertCircle, CheckCircle, XCircle, HardDrive, Key, Activity, Clock, Search, MoreVertical, Eye } from 'lucide-react'
import { useRequireAdmin } from '@/hooks/useRequireAdmin'

interface RedisInfo {
  connected: boolean
  version?: string
  uptime?: number
  connected_clients?: number
  used_memory?: string
  used_memory_human?: string
  used_memory_peak?: string
  used_memory_peak_human?: string
  total_system_memory?: string
  total_system_memory_human?: string
  maxmemory?: string
  maxmemory_human?: string
  keyspace_hits?: number
  keyspace_misses?: number
  total_commands_processed?: number
  instantaneous_ops_per_sec?: number
  total_keys?: number
  db_size?: number
  error?: string
}

interface RedisKey {
  key: string
  type: string
  ttl?: number
  size?: number
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function RedisManagementPage() {
  useRequireAdmin()
  
  const [redisInfo, setRedisInfo] = useState<RedisInfo>({ connected: false })
  const [keys, setKeys] = useState<RedisKey[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [keyValue, setKeyValue] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: 10, total: 0, totalPages: 0 })
  const [showFlushDialog, setShowFlushDialog] = useState(false)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  const [showDeleteKeyDialog, setShowDeleteKeyDialog] = useState(false)
  const [keyToDelete, setKeyToDelete] = useState<string | null>(null)
  const [showViewKeyModal, setShowViewKeyModal] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState<{ top: boolean; bottom: boolean }>({ top: false, bottom: true })
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})
  const buttonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({})

  useEffect(() => {
    fetchRedisInfo()
    fetchKeys()
  }, [page, limit])

  const fetchRedisInfo = async () => {
    try {
      const response = await fetch('/api/admin/redis/info')
      const data = await response.json()
      setRedisInfo(data)
    } catch (error) {
      console.error('Failed to fetch Redis info:', error)
      setRedisInfo({ connected: false, error: 'Failed to connect to Redis' })
    }
  }

  const fetchKeys = async () => {
    try {
      const response = await fetch(`/api/admin/redis/keys?page=${page}&limit=${limit}`)
      const data = await response.json()
      setKeys(data.keys || [])
      setPagination(data.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 })
    } catch (error) {
      console.error('Failed to fetch keys:', error)
    }
  }

  const fetchKeyValue = async (key: string) => {
    try {
      const response = await fetch(`/api/admin/redis/key?key=${encodeURIComponent(key)}`)
      const data = await response.json()
      setKeyValue(data.value)
      setSelectedKey(key)
      setShowViewKeyModal(true)
    } catch (error) {
      console.error('Failed to fetch key value:', error)
    }
  }

  const deleteKey = async (key: string) => {
    setKeyToDelete(key)
    setShowDeleteKeyDialog(true)
  }

  const handleDeleteKeyConfirm = async () => {
    if (!keyToDelete) return
    
    try {
      await fetch(`/api/admin/redis/key?key=${encodeURIComponent(keyToDelete)}`, { method: 'DELETE' })
      await fetchKeys()
      await fetchRedisInfo()
      setShowDeleteKeyDialog(false)
      setKeyToDelete(null)
    } catch (error) {
      console.error('Failed to delete key:', error)
    }
  }

  const flushDatabase = async () => {
    setShowFlushDialog(true)
  }

  const handleFlushConfirm = async () => {
    try {
      await fetch('/api/admin/redis/flush', { method: 'POST' })
      setPage(1)
      await fetchKeys()
      await fetchRedisInfo()
      setSelectedKey(null)
      setKeyValue(null)
      setShowFlushDialog(false)
    } catch (error) {
      console.error('Failed to flush database:', error)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([fetchRedisInfo(), fetchKeys()])
    setRefreshing(false)
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit)
    setPage(1)
  }

  const handleDropdownToggle = (key: string) => {
    if (openDropdownId === key) {
      setOpenDropdownId(null)
      return
    }

    const button = buttonRefs.current[key]
    if (button) {
      const rect = button.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top

      // Dropdown is approximately 120px tall
      const dropdownHeight = 120

      if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
        setDropdownPosition({ top: true, bottom: false })
      } else {
        setDropdownPosition({ top: false, bottom: true })
      }
    }

    setOpenDropdownId(key)
  }

  const getDropdownPosition = (key: string) => {
    const button = buttonRefs.current[key]
    if (!button) return 0
    const rect = button.getBoundingClientRect()
    if (dropdownPosition.top) {
      return rect.top - 120
    }
    return rect.bottom
  }

  const filteredKeys = keys.filter(key => 
    key.key.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  return (
    <div className="min-h-screen p-8 bg-gray-100 dark:bg-gray-900">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Redis Management</h1>
        <p className="text-gray-600 dark:text-gray-400">Monitor and manage your Redis instance</p>
      </div>

      {/* Connection Status */}
      <div className={`mb-6 p-4 rounded-xl border ${
        redisInfo.connected 
          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      }`}>
        <div className="flex items-center gap-3">
          {redisInfo.connected ? (
            <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
          ) : (
            <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
          )}
          <div>
            <p className={`font-semibold ${redisInfo.connected ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
              {redisInfo.connected ? 'Redis Connected' : 'Redis Disconnected'}
            </p>
            {redisInfo.version && (
              <p className="text-sm text-gray-600 dark:text-gray-400">Version: {redisInfo.version}</p>
            )}
            {redisInfo.error && (
              <p className="text-sm text-red-600 dark:text-red-400">{redisInfo.error}</p>
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="ml-auto p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {redisInfo.connected && (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-2">
                <HardDrive className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Used Memory</p>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {redisInfo.used_memory_human || '-'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Peak: {redisInfo.used_memory_peak_human || '-'}
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-2">
                <Key className="w-5 h-5 text-green-600 dark:text-green-400" />
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Keys</p>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {redisInfo.total_keys || redisInfo.db_size || '-'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Database size
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-2">
                <Activity className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Ops/sec</p>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {redisInfo.instantaneous_ops_per_sec || '-'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Instantaneous
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Uptime</p>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {redisInfo.uptime ? formatUptime(redisInfo.uptime) : '-'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Server running
              </p>
            </div>
          </div>

          {/* Additional Stats */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Performance Metrics</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Connected Clients</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {redisInfo.connected_clients || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Key Space Hits</p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">
                  {redisInfo.keyspace_hits?.toLocaleString() || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Key Space Misses</p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400">
                  {redisInfo.keyspace_misses?.toLocaleString() || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Commands</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {redisInfo.total_commands_processed?.toLocaleString() || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Hit Rate</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {redisInfo.keyspace_hits && redisInfo.keyspace_misses 
                    ? ((redisInfo.keyspace_hits / (redisInfo.keyspace_hits + redisInfo.keyspace_misses)) * 100).toFixed(2) + '%'
                    : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Max Memory</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {redisInfo.maxmemory_human || 'Unlimited'}
                </p>
              </div>
            </div>
          </div>

          {/* Keys Management */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mb-8 overflow-visible">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Keys Management</h3>
                <button
                  onClick={flushDatabase}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Flush Database
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search keys..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Key</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">TTL</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {keys.map((key, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {key.key}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {key.type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {key.ttl && key.ttl > -1 ? `${key.ttl}s` : 'No expiry'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <div className="relative inline-block text-left">
                      <button
                        ref={(el) => { buttonRefs.current[key.key] = el }}
                        onClick={() => handleDropdownToggle(key.key)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
                      >
                        <MoreVertical className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                      </button>
                      {openDropdownId === key.key && (
                        <div
                          ref={(el) => { dropdownRefs.current[key.key] = el }}
                          className={`fixed right-4 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-[100] ${
                            dropdownPosition.top ? 'mb-2' : 'mt-2'
                          }`}
                          style={{
                            top: getDropdownPosition(key.key)
                          }}
                        >
                          <div className="py-1">
                            <button
                              onClick={() => {
                                setOpenDropdownId(null)
                                fetchKeyValue(key.key)
                              }}
                              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View
                            </button>
                            <button
                              onClick={() => {
                                setOpenDropdownId(null)
                                deleteKey(key.key)
                              }}
                              className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                    </tr>
                  ))}
                  {keys.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                        No keys found in database
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="p-6 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} keys
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={limit}
                      onChange={(e) => handleLimitChange(parseInt(e.target.value))}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    >
                      <option value={10}>10 per page</option>
                      <option value={25}>25 per page</option>
                      <option value={50}>50 per page</option>
                      <option value={100}>100 per page</option>
                    </select>
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-2 text-sm text-gray-900 dark:text-white">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.totalPages}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* View Key Modal */}
          {showViewKeyModal && selectedKey && keyValue !== null && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-3xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Key Value: {selectedKey}</h3>
                    <button
                      onClick={() => {
                        setShowViewKeyModal(false)
                        setSelectedKey(null)
                        setKeyValue(null)
                      }}
                      className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      <XCircle className="w-6 h-6" />
                    </button>
                  </div>
                </div>
                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                  <style dangerouslySetInnerHTML={{
                    __html: `
                      .custom-scrollbar::-webkit-scrollbar {
                        width: 8px;
                      }
                      .custom-scrollbar::-webkit-scrollbar-track {
                        background: rgba(0, 0, 0, 0.05);
                        border-radius: 10px;
                      }
                      .custom-scrollbar::-webkit-scrollbar-thumb {
                        background: rgba(156, 163, 175, 0.5);
                        border-radius: 10px;
                        transition: background 0.2s ease;
                      }
                      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                        background: rgba(156, 163, 175, 0.8);
                      }
                      @media (prefers-color-scheme: dark) {
                        .custom-scrollbar::-webkit-scrollbar-track {
                          background: rgba(255, 255, 255, 0.05);
                        }
                        .custom-scrollbar::-webkit-scrollbar-thumb {
                          background: rgba(107, 114, 128, 0.5);
                        }
                        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                          background: rgba(107, 114, 128, 0.8);
                        }
                      }
                    `
                  }} />
                  <pre className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-x-auto text-sm text-gray-900 dark:text-gray-100">
                    {typeof keyValue === 'object' ? JSON.stringify(keyValue, null, 2) : String(keyValue)}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Delete Key Confirmation Dialog */}
          {showDeleteKeyDialog && keyToDelete && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full mx-4">
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                      <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">Delete Key</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Are you sure you want to delete key <strong>{keyToDelete}</strong>? This action cannot be undone.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      onClick={() => {
                        setShowDeleteKeyDialog(false)
                        setKeyToDelete(null)
                      }}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteKeyConfirm}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Flush Database Confirmation Dialog */}
          {showFlushDialog && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full mx-4">
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                      <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">Flush Database</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Are you sure you want to flush all keys from the database? This action cannot be undone.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      onClick={() => setShowFlushDialog(false)}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleFlushConfirm}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                    >
                      Flush
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
