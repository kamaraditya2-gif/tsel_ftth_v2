'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Edit, Trash2, MoreVertical, Gauge } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface SpeedGroup {
  id: number
  name: string
  speed_limit: number | null
  profile: string | null
  description: string | null
  device_count: number
  created_at: string
}

export default function SpeedsPage() {
  const router = useRouter()
  const [speedGroups, setSpeedGroups] = useState<SpeedGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState<SpeedGroup | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [groupToDelete, setGroupToDelete] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    speed_limit: '',
    profile: '',
    description: ''
  })
  const [message, setMessage] = useState('')
  const [openDropdown, setOpenDropdown] = useState<number | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedGroupForDetail, setSelectedGroupForDetail] = useState<SpeedGroup | null>(null)
  const [historicalTestResults, setHistoricalTestResults] = useState<{
    ping: any[]
    upload: any[]
    download: any[]
  }>({
    ping: [],
    upload: [],
    download: []
  })
  const [loadingHistoricalResults, setLoadingHistoricalResults] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)

  const fetchUserRole = async () => {
    try {
      const res = await fetch('/api/user-role')
      const data = await res.json()
      setUserRole(data.role_name)
    } catch (error) {
      console.error('Failed to fetch user role:', error)
      setUserRole(null)
    }
  }

  useEffect(() => {
    fetchSpeedGroups()
    fetchUserRole()
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openDropdown !== null) {
        const target = event.target as HTMLElement
        if (!target.closest('.dropdown-menu')) {
          setOpenDropdown(null)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openDropdown])

  const fetchSpeedGroups = async () => {
    try {
      const res = await fetch('/api/speed-groups')
      const data = await res.json()
      if (Array.isArray(data)) {
        setSpeedGroups(data)
      } else {
        console.error('Unexpected speed groups response:', data)
        setSpeedGroups([])
      }
    } catch (err) {
      console.error('Error fetching speed groups:', err)
      setSpeedGroups([])
    } finally {
      setLoading(false)
    }
  }

  const handleAddGroup = () => {
    setEditingGroup(null)
    setFormData({
      name: '',
      speed_limit: '',
      profile: '',
      description: ''
    })
    setMessage('')
    setShowModal(true)
  }

  const handleEditGroup = (group: SpeedGroup) => {
    setEditingGroup(group)
    setFormData({
      name: group.name,
      speed_limit: group.speed_limit?.toString() || '',
      profile: group.profile || '',
      description: group.description || ''
    })
    setMessage('')
    setShowModal(true)
  }

  const handleDeleteGroup = (groupId: number) => {
    setGroupToDelete(groupId)
    setShowDeleteConfirm(true)
  }

  const confirmDelete = async () => {
    if (!groupToDelete) return
    
    try {
      await fetch(`/api/speed-groups/${groupToDelete}`, { method: 'DELETE' })
      setShowDeleteConfirm(false)
      setGroupToDelete(null)
      fetchSpeedGroups()
    } catch (err) {
      console.error('Error deleting speed group:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      let res
      if (editingGroup) {
        res = await fetch(`/api/speed-groups/${editingGroup.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            speed_limit: formData.speed_limit ? parseFloat(formData.speed_limit) : null,
          })
        })
      } else {
        res = await fetch('/api/speed-groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            speed_limit: formData.speed_limit ? parseFloat(formData.speed_limit) : null,
          })
        })
      }
      
      if (res.ok) {
        setShowModal(false)
        fetchSpeedGroups()
      } else {
        const data = await res.json()
        setMessage(data.error || 'Failed to save speed group')
      }
    } catch (err) {
      console.error('Error saving speed group:', err)
      setMessage('Error saving speed group')
    }
  }

  const handleViewDetail = async (group: SpeedGroup) => {
    setSelectedGroupForDetail(group)
    setShowDetailModal(true)
    setLoadingHistoricalResults(true)
    
    try {
      // Fetch ping data for latency chart
      const pingRes = await fetch(`/api/queue-results?speed_id=${group.id}&test_type=ping&hours=24&limit=100`)
      const pingData = await pingRes.json()
      
      // Fetch upload data for speed chart
      const uploadRes = await fetch(`/api/queue-results?speed_id=${group.id}&test_type=speed_upload&hours=24&limit=100`)
      const uploadData = await uploadRes.json()
      
      // Fetch download data for speed chart
      const downloadRes = await fetch(`/api/queue-results?speed_id=${group.id}&test_type=speed_download&hours=24&limit=100`)
      const downloadData = await downloadRes.json()
      
      setHistoricalTestResults({
        ping: pingData.data || [],
        upload: uploadData.data || [],
        download: downloadData.data || []
      })
    } catch (error) {
      console.error('Error fetching historical test results:', error)
      setHistoricalTestResults({
        ping: [],
        upload: [],
        download: []
      })
    } finally {
      setLoadingHistoricalResults(false)
    }
  }

  return (
    <div className="min-h-screen p-8 bg-white/90 dark:bg-gray-800/90">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Speeds</h1>
        {userRole !== 'viewer' && (
          <button
            onClick={handleAddGroup}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Speed Group
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        {loading ? (
          <div className="p-6 text-gray-600 dark:text-gray-400">Loading...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Speed Limit (<span className="normal-case">Mbps</span>)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Profile
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Device Count
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Description
                </th>
                {userRole !== 'viewer' && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {speedGroups.map((group) => (
                <tr key={group.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    <button
                      onClick={() => handleViewDetail(group)}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer"
                    >
                      {group.name}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {group.speed_limit || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      group.profile === 'Platinum' ? 'bg-purple-100 text-purple-700' :
                      group.profile === 'Gold' ? 'bg-yellow-100 text-yellow-700' :
                      group.profile === 'Silver' ? 'bg-gray-100 text-gray-700' :
                      group.profile === 'Bronze' ? 'bg-amber-100 text-amber-700' : ''
                    }`}>{group.profile || '-'}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => router.push(`/devices?speed=${group.id}`)}
                      className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800 cursor-pointer transition-colors"
                    >
                      {group.device_count || 0}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {group.description || '-'}
                  </td>
                  {userRole !== 'viewer' && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium relative dropdown-menu">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenDropdown(openDropdown === group.id ? null : group.id)
                        }}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>
                      {openDropdown === group.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50 border border-gray-200 dark:border-gray-700">
                          <button
                            onClick={() => {
                              handleEditGroup(group)
                              setOpenDropdown(null)
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                          >
                            <Edit className="w-4 h-4" />
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              handleDeleteGroup(group.id)
                              setOpenDropdown(null)
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Speed Group Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {editingGroup ? 'Edit Speed Group' : 'Add Speed Group'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Speed Limit (Mbps)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.speed_limit}
                  onChange={(e) => setFormData({ ...formData, speed_limit: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Profile</label>
                <select value={formData.profile} onChange={(e) => setFormData({ ...formData, profile: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                  <option value="">Select profile</option>
                  <option value="Bronze">Bronze</option>
                  <option value="Silver">Silver</option>
                  <option value="Gold">Gold</option>
                  <option value="Platinum">Platinum</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={3}
                />
              </div>
              {message && (
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200">
                  {message}
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  {editingGroup ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Confirm Delete
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete this speed group?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedGroupForDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Speed Group Detail
              </h2>
              <button
                onClick={() => {
                  setShowDetailModal(false)
                  setSelectedGroupForDetail(null)
                  setHistoricalTestResults({
                    ping: [],
                    upload: [],
                    download: []
                  })
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name
                  </label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {selectedGroupForDetail.name}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Speed Limit
                  </label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {selectedGroupForDetail.speed_limit || '-'} Mbps
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Profile</label>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedGroupForDetail.profile || '-'}</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <p className="text-sm text-gray-900 dark:text-white">
                  {selectedGroupForDetail.description || '-'}
                </p>
              </div>

              {/* Performance History */}
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Performance History (24 Hours)</h3>
                
                {loadingHistoricalResults ? (
                  <div className="text-center text-gray-500 dark:text-gray-400 py-8">Loading performance data...</div>
                ) : (historicalTestResults.ping.length > 0 || historicalTestResults.upload.length > 0 || historicalTestResults.download.length > 0) ? (
                  <>
                    {/* Latency Chart */}
                    {historicalTestResults.ping.length > 0 && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600 mb-4">
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wide">Latency (ms)</p>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={historicalTestResults.ping
                          .sort((a, b) => new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime())
                          .map(r => ({
                            time: new Date(r.executed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                            igw: r.ping_igw,
                            ebr: r.ping_ebr
                          }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="time" stroke="#6b7280" fontSize={12} />
                          <YAxis stroke="#6b7280" fontSize={12} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                            itemStyle={{ color: '#f3f4f6' }}
                            formatter={(value: any) => value !== null ? Number(value).toFixed(2) : 'N/A'}
                          />
                          <Legend />
                          <Line type="monotone" dataKey="igw" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="near IGW" connectNulls={true} />
                          <Line type="monotone" dataKey="ebr" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} name="near EBR" connectNulls={true} />
                        </LineChart>
                      </ResponsiveContainer>
                      {/* Latency Statistics */}
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2">near IGW</p>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">MIN</p>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {historicalTestResults.ping.filter(r => r.ping_igw !== null).length > 0 
                                  ? Math.min(...historicalTestResults.ping.filter(r => r.ping_igw !== null).map(r => Number(r.ping_igw))).toFixed(2) 
                                  : '-'} ms
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">MAX</p>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {historicalTestResults.ping.filter(r => r.ping_igw !== null).length > 0 
                                  ? Math.max(...historicalTestResults.ping.filter(r => r.ping_igw !== null).map(r => Number(r.ping_igw))).toFixed(2) 
                                  : '-'} ms
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">AVG</p>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {historicalTestResults.ping.filter(r => r.ping_igw !== null).length > 0 
                                  ? (historicalTestResults.ping.filter(r => r.ping_igw !== null).reduce((sum, r) => sum + Number(r.ping_igw), 0) / historicalTestResults.ping.filter(r => r.ping_igw !== null).length).toFixed(2) 
                                  : '-'} ms
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                          <p className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-2">near EBR</p>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">MIN</p>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {historicalTestResults.ping.filter(r => r.ping_ebr !== null).length > 0 
                                  ? Math.min(...historicalTestResults.ping.filter(r => r.ping_ebr !== null).map(r => Number(r.ping_ebr))).toFixed(2) 
                                  : '-'} ms
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">MAX</p>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {historicalTestResults.ping.filter(r => r.ping_ebr !== null).length > 0 
                                  ? Math.max(...historicalTestResults.ping.filter(r => r.ping_ebr !== null).map(r => Number(r.ping_ebr))).toFixed(2) 
                                  : '-'} ms
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">AVG</p>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {historicalTestResults.ping.filter(r => r.ping_ebr !== null).length > 0 
                                  ? (historicalTestResults.ping.filter(r => r.ping_ebr !== null).reduce((sum, r) => sum + Number(r.ping_ebr), 0) / historicalTestResults.ping.filter(r => r.ping_ebr !== null).length).toFixed(2) 
                                  : '-'} ms
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    )}

                    {/* Speed Chart */}
                    {(historicalTestResults.upload.length > 0 || historicalTestResults.download.length > 0) && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600 mb-4">
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wide">Speed (<span className="normal-case">Mbps</span>)</p>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={(() => {
                          // Combine upload and download data by timestamp
                          const combined = [
                            ...historicalTestResults.download.map(r => ({
                              time: new Date(r.executed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                              download: r.download_speed !== null ? Number(r.download_speed) : null,
                              upload: null
                            })),
                            ...historicalTestResults.upload.map(r => ({
                              time: new Date(r.executed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                              download: null,
                              upload: r.upload_speed !== null ? Number(r.upload_speed) : null
                            }))
                          ]
                          return combined.sort((a, b) => {
                            const timeA = new Date(a.time).getTime()
                            const timeB = new Date(b.time).getTime()
                            return timeA - timeB
                          })
                        })()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="time" stroke="#6b7280" fontSize={12} />
                          <YAxis stroke="#6b7280" fontSize={12} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                            itemStyle={{ color: '#f3f4f6' }}
                            formatter={(value: any) => value !== null ? Number(value).toFixed(2) : 'N/A'}
                          />
                          <Legend />
                          <Line type="monotone" dataKey="download" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="Download" connectNulls={true} />
                          <Line type="monotone" dataKey="upload" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Upload" connectNulls={true} />
                        </LineChart>
                      </ResponsiveContainer>
                      {/* Speed Statistics */}
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                          <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-2">Download</p>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">MIN</p>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {historicalTestResults.download.length > 0 && historicalTestResults.download.filter(r => r.download_speed !== null).length > 0
                                  ? Math.min(...historicalTestResults.download.filter(r => r.download_speed !== null).map(r => Number(r.download_speed))).toFixed(2) 
                                  : '-'} Mbps
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">MAX</p>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {historicalTestResults.download.length > 0 && historicalTestResults.download.filter(r => r.download_speed !== null).length > 0
                                  ? Math.max(...historicalTestResults.download.filter(r => r.download_speed !== null).map(r => Number(r.download_speed))).toFixed(2) 
                                  : '-'} Mbps
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">AVG</p>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {historicalTestResults.download.length > 0 && historicalTestResults.download.filter(r => r.download_speed !== null).length > 0
                                  ? (historicalTestResults.download.filter(r => r.download_speed !== null).reduce((sum, r) => sum + Number(r.download_speed), 0) / historicalTestResults.download.filter(r => r.download_speed !== null).length).toFixed(2) 
                                  : '-'} Mbps
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                          <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400 mb-2">Upload</p>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">MIN</p>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {historicalTestResults.upload.length > 0 && historicalTestResults.upload.filter(r => r.upload_speed !== null).length > 0
                                  ? Math.min(...historicalTestResults.upload.filter(r => r.upload_speed !== null).map(r => Number(r.upload_speed))).toFixed(2) 
                                  : '-'} Mbps
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">MAX</p>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {historicalTestResults.upload.length > 0 && historicalTestResults.upload.filter(r => r.upload_speed !== null).length > 0
                                  ? Math.max(...historicalTestResults.upload.filter(r => r.upload_speed !== null).map(r => Number(r.upload_speed))).toFixed(2) 
                                  : '-'} Mbps
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">AVG</p>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {historicalTestResults.upload.length > 0 && historicalTestResults.upload.filter(r => r.upload_speed !== null).length > 0
                                  ? (historicalTestResults.upload.filter(r => r.upload_speed !== null).reduce((sum, r) => sum + Number(r.upload_speed), 0) / historicalTestResults.upload.filter(r => r.upload_speed !== null).length).toFixed(2) 
                                  : '-'} Mbps
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    )}
                  </>
                ) : (
                  <div className="text-center text-gray-500 dark:text-gray-400 py-8">No performance data available for the last 24 hours</div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setShowDetailModal(false)
                    setSelectedGroupForDetail(null)
                    setHistoricalTestResults({
                      ping: [],
                      upload: [],
                      download: []
                    })
                    router.push(`/devices?speed=${selectedGroupForDetail.id}`)
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  View Devices
                </button>
                <button
                  onClick={() => {
                    setShowDetailModal(false)
                    setSelectedGroupForDetail(null)
                    setHistoricalTestResults({
                      ping: [],
                      upload: [],
                      download: []
                    })
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
