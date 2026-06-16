'use client'

import { useState, useEffect } from 'react'
import { MoreVertical, Play, Edit, Trash2, X } from 'lucide-react'

interface Task {
  id: number
  title: string
  task_type: string
  test_type: string
  group_id: number | null
  device_id: number | null
  cron_time: string | null
  started_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  group_name: string | null
  group_code: string | null
  device_serial: string | null
  device_indihome: string | null
  next_run: string | null
  completed_count: number
  failed_count: number
  total_count: number
  device_count: number
}

export default function OnDemandTestPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [openDropdown, setOpenDropdown] = useState<number | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showRunConfirm, setShowRunConfirm] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [editFormData, setEditFormData] = useState({
    title: '',
    test_types: ['ping', 'traceroute', 'download', 'upload', 'ont-status'],
    started_at: '',
    is_active: true
  })
  const [message, setMessage] = useState('')
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

  const fetchTasks = async () => {
    try {
      const res = await fetch(`/api/tasks?task_type=ondemand&page=${page}&limit=10`)
      const data = await res.json()
      setTasks(data.data || [])
      setTotalPages(data.pagination?.totalPages || 1)
    } catch (error) {
      console.error('Error fetching tasks:', error)
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTasks()
    fetchUserRole()
  }, [page])

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

  const handleEdit = (task: Task) => {
    const formatDateTimeForInput = (dateString: string | null): string => {
      if (!dateString) return ''
      const date = new Date(dateString)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day}T${hours}:${minutes}`
    }

    setSelectedTask(task)
    setEditFormData({
      title: task.title,
      test_types: task.test_type ? task.test_type.split(',').map(t => t.trim()) : ['ping', 'traceroute', 'download', 'upload', 'ont-status'],
      started_at: formatDateTimeForInput(task.started_at),
      is_active: task.is_active
    })
    setShowEditModal(true)
    setOpenDropdown(null)
  }

  const handleTestTypeChange = (testType: string) => {
    setEditFormData(prev => {
      if (prev.test_types.includes(testType)) {
        return {
          ...prev,
          test_types: prev.test_types.filter(t => t !== testType)
        }
      } else {
        return {
          ...prev,
          test_types: [...prev.test_types, testType]
        }
      }
    })
  }

  const handleDelete = (task: Task) => {
    setSelectedTask(task)
    setShowDeleteConfirm(true)
    setOpenDropdown(null)
  }

  const handleRun = (task: Task) => {
    setSelectedTask(task)
    setShowRunConfirm(true)
    setOpenDropdown(null)
  }

  const confirmRun = async () => {
    if (!selectedTask) return

    try {
      const res = await fetch(`/api/tasks/${selectedTask.id}/run`, {
        method: 'POST'
      })

      if (res.ok) {
        setShowRunConfirm(false)
        setSelectedTask(null)
        fetchTasks()
      } else {
        const data = await res.json()
        setMessage(data.error || 'Failed to run task')
      }
    } catch (err) {
      console.error('Error running task:', err)
      setMessage('Failed to run task')
    }
  }

  const confirmDelete = async () => {
    if (!selectedTask) return

    try {
      const res = await fetch(`/api/tasks?id=${selectedTask.id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        setShowDeleteConfirm(false)
        setSelectedTask(null)
        fetchTasks()
      } else {
        const data = await res.json()
        setMessage(data.error || 'Failed to delete task')
      }
    } catch (err) {
      console.error('Error deleting task:', err)
      setMessage('Failed to delete task')
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (editFormData.test_types.length === 0) {
      setMessage('Please select at least one test type')
      return
    }
    
    if (!selectedTask) return
    
    try {
      const res = await fetch(`/api/tasks?id=${selectedTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editFormData.title,
          test_type: editFormData.test_types.join(','),
          is_active: editFormData.is_active,
          started_at: editFormData.started_at || null,
          next_run: editFormData.started_at || null
        })
      })
      
      if (res.ok) {
        setShowEditModal(false)
        setSelectedTask(null)
        setMessage('')
        fetchTasks()
      } else {
        const data = await res.json()
        setMessage(data.error || 'Failed to update task')
      }
    } catch (err) {
      console.error('Error updating task:', err)
      setMessage('Error updating task')
    }
  }

  const formatRelativeTime = (dateString: string): string => {
    if (!dateString) return '-'
    
    const date = new Date(dateString)
    const now = new Date()
    
    // Check if same day
    const isSameDay = 
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    
    if (isSameDay) {
      // Same day: show only time in 24h format
      return new Intl.DateTimeFormat('en-ID', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Jakarta'
      }).format(date)
    } else {
      // Different day: show "May 17, 2026, 06:37" format
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Jakarta'
      }).format(date)
    }
  }

  return (
    <div className="min-h-screen p-8 bg-white/90 dark:bg-gray-800/90">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">On Demand Test</h1>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        {loading ? (
          <div className="p-8 text-center text-gray-600 dark:text-gray-400">
            Loading...
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-8 text-center text-gray-600 dark:text-gray-400">
            No on-demand tests found
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">#</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Test Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Regional</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Count Test</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Started At</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                  {userRole !== 'viewer' && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Action</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {tasks.map((task, index) => (
                  <tr key={task.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {(page - 1) * 10 + index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {task.title}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {task.test_type ? (
                        <div className="flex flex-wrap gap-1">
                          {task.test_type.split(',').map((type) => {
                            const trimmedType = type.trim()
                            const badgeColors: Record<string, string> = {
                              ping: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
                              traceroute: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
                              download: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
                              upload: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
                              'ont-status': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                            }
                            return (
                              <span
                                key={trimmedType}
                                className={`px-2 py-1 text-[10px] font-medium rounded-full ${badgeColors[trimmedType] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}`}
                              >
                                {trimmedType}
                              </span>
                            )
                          })}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {task.group_code ? `${task.group_code} (${task.device_count})` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      <span className="text-green-600 dark:text-green-400 font-semibold">{task.completed_count}</span> / <span className="text-red-600 dark:text-red-400 font-semibold">{task.failed_count}</span> / {task.total_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {task.created_at ? formatRelativeTime(task.created_at) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {task.is_active ? (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                          Inactive
                        </span>
                      )}
                    </td>
                    {userRole !== 'viewer' && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium relative dropdown-menu">
                        <button
                          onClick={() => setOpenDropdown(openDropdown === task.id ? null : task.id)}
                          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1"
                        >
                          <MoreVertical className="w-5 h-5" />
                        </button>
                        {openDropdown === task.id && (
                          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50 border border-gray-200 dark:border-gray-700">
                              {task.is_active && (
                                <button
                                  onClick={() => handleRun(task)}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                                >
                                  <Play className="w-4 h-4" />
                                  Run
                                </button>
                              )}
                              <button
                                onClick={() => handleEdit(task)}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                              >
                                <Edit className="w-4 h-4" />
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(task)}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
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
        
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Edit On Demand Test
            </h2>
            {message && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-lg text-sm">
                {message}
              </div>
            )}
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={editFormData.title}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Test Type
                </label>
                <div className="flex gap-4 flex-wrap">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editFormData.test_types.includes('ping')}
                      onChange={() => handleTestTypeChange('ping')}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Ping</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editFormData.test_types.includes('traceroute')}
                      onChange={() => handleTestTypeChange('traceroute')}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Traceroute</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editFormData.test_types.includes('download')}
                      onChange={() => handleTestTypeChange('download')}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Download</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editFormData.test_types.includes('upload')}
                      onChange={() => handleTestTypeChange('upload')}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Upload</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editFormData.test_types.includes('ont-status')}
                      onChange={() => handleTestTypeChange('ont-status')}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">ONT Status</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Started At
                </label>
                <input
                  type="datetime-local"
                  value={editFormData.started_at}
                  onChange={(e) => setEditFormData({ ...editFormData, started_at: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editFormData.is_active}
                    onChange={(e) => setEditFormData({ ...editFormData, is_active: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
                </label>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    setSelectedTask(null)
                    setMessage('')
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Confirm Delete
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete "{selectedTask.title}"?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setSelectedTask(null)
                }}
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

      {/* Run Confirmation Modal */}
      {showRunConfirm && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Confirm Run
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to run "{selectedTask.title}"?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRunConfirm(false)
                  setSelectedTask(null)
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRun}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Run
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
