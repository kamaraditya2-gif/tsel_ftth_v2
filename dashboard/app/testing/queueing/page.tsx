'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Trash2, X, MoreVertical, RefreshCw, Eye, Download } from 'lucide-react'

interface QueueJob {
  id: string
  task_id: number | null
  task_title: string | null
  device_id: number | null
  serial_number: string | null
  indihome_id: string | null
region_name: string | null
  regional_code: string | null
  group_id: number | null
  execution_type: string
  test_type: string | null
  status: string
  retry_count: number
  last_error: string | null
  raw_response: any | null
  created_at: string
}

interface Task {
  id: number
  title: string
  task_type: string
}

interface Regional {
  id: number
  code: string
}

interface Device {
  id: number
  serial_number: string
  indihome_id: string
}

function QueueingPage() {
  const searchParams = useSearchParams()
  const [jobs, setJobs] = useState<QueueJob[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showClearRecentConfirm, setShowClearRecentConfirm] = useState(false)
  const [clearRecentLoading, setClearRecentLoading] = useState(false)
  const [actionDropdown, setActionDropdown] = useState<string | null>(null)
  const [showDeleteSingleConfirm, setShowDeleteSingleConfirm] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [retestLoading, setRetestLoading] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedJob, setSelectedJob] = useState<QueueJob | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [regionals, setRegionals] = useState<Regional[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [selectedTask, setSelectedTask] = useState<string>('')
  const [selectedRegional, setSelectedRegional] = useState<string>('')
  const [selectedDevice, setSelectedDevice] = useState<string>('')
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [statistics, setStatistics] = useState<any>(null)
  const [loadingStatistics, setLoadingStatistics] = useState(false)
  const [showTestTypeModal, setShowTestTypeModal] = useState(false)
  const [selectedTestType, setSelectedTestType] = useState<any>(null)
  const [showDeviceFailuresModal, setShowDeviceFailuresModal] = useState(false)
  const [selectedDeviceForFailures, setSelectedDeviceForFailures] = useState<any>(null)
  const [deviceFailures, setDeviceFailures] = useState<any[]>([])
  const [loadingDeviceFailures, setLoadingDeviceFailures] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    fetchTasks()
    fetchRegionals()
    fetchDevices()
    fetchStatistics()
    fetchUserRole()
    
    // Read task_id from URL query parameter
    const taskIdParam = searchParams.get('task_id')
    if (taskIdParam) {
      setSelectedTask(taskIdParam)
    }
  }, [])

  useEffect(() => {
    fetchJobs()
  }, [page, selectedTask, selectedRegional, selectedDevice, selectedStatus])

  const fetchJobs = async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10'
      })
      if (selectedTask) params.append('task_id', selectedTask)
      if (selectedRegional) params.append('group_id', selectedRegional)
      if (selectedDevice) params.append('device_id', selectedDevice)
      if (selectedStatus) params.append('status', selectedStatus)
      
      const res = await fetch(`/api/queue-jobs?${params.toString()}`)
      const data = await res.json()
      setJobs(data.data || [])
      setTotalPages(data.pagination?.totalPages || 1)
    } catch (error) {
      console.error('Error fetching queue jobs:', error)
      setJobs([])
    } finally {
      setLoading(false)
    }
  }

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks')
      const data = await res.json()
      setTasks(data.data || [])
    } catch (error) {
      console.error('Error fetching tasks:', error)
    }
  }

  const fetchRegionals = async () => {
    try {
      const res = await fetch('/api/group-devices')
      const data = await res.json()
      if (Array.isArray(data)) {
        setRegionals(data)
      } else {
        console.error('Unexpected regionals response:', data)
        setRegionals([])
      }
    } catch (error) {
      console.error('Error fetching regionals:', error)
      setRegionals([])
    }
  }

  const fetchDevices = async () => {
    try {
      const res = await fetch('/api/devices')
      const data = await res.json()
      if (Array.isArray(data)) {
        setDevices(data)
      } else {
        console.error('Unexpected devices response:', data)
        setDevices([])
      }
    } catch (error) {
      console.error('Error fetching devices:', error)
      setDevices([])
    }
  }

  const fetchStatistics = async () => {
    setLoadingStatistics(true)
    try {
      const res = await fetch('/api/queue-results/statistics?hours=24')
      const data = await res.json()
      setStatistics(data)
    } catch (error) {
      console.error('Error fetching statistics:', error)
    } finally {
      setLoadingStatistics(false)
    }
  }

  const fetchDeviceFailures = async (deviceId: number) => {
    setLoadingDeviceFailures(true)
    try {
      const params = new URLSearchParams({
        device_id: deviceId.toString(),
        hours: '24',
        limit: '100'
      })
      const res = await fetch(`/api/queue-jobs?${params.toString()}&status=failed`)
      const data = await res.json()
      setDeviceFailures(data.data || [])
    } catch (error) {
      console.error('Error fetching device failures:', error)
      setDeviceFailures([])
    } finally {
      setLoadingDeviceFailures(false)
    }
  }

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

  const handleDeleteAll = async () => {
    setDeleteLoading(true)
    try {
      const res = await fetch('/api/queue-jobs', { method: 'DELETE' })
      if (res.ok) {
        setShowDeleteConfirm(false)
        setPage(1)
        fetchJobs()
      } else {
        console.error('Failed to delete all queue jobs')
      }
    } catch (error) {
      console.error('Error deleting all queue jobs:', error)
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleClearRecent = async () => {
    setClearRecentLoading(true)
    try {
      const res = await fetch('/api/queue-jobs/clear-recent', { method: 'POST' })
      if (res.ok) {
        setShowClearRecentConfirm(false)
        setPage(1)
        fetchJobs()
        fetchStatistics()
      } else {
        const err = await res.json()
        console.error('Failed to clear recent queue jobs:', err)
      }
    } catch (error) {
      console.error('Error clearing recent queue jobs:', error)
    } finally {
      setClearRecentLoading(false)
    }
  }

  const handleDeleteSingle = async () => {
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/queue-jobs/${selectedJobId}`, { method: 'DELETE' })
      if (res.ok) {
        setShowDeleteSingleConfirm(false)
        setSelectedJobId(null)
        fetchJobs()
      } else {
        console.error('Failed to delete queue job')
      }
    } catch (error) {
      console.error('Error deleting queue job:', error)
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleRetest = async (jobId: string) => {
    setRetestLoading(true)
    try {
      const res = await fetch(`/api/queue-jobs/${jobId}/retest`, { method: 'POST' })
      if (res.ok) {
        setActionDropdown(null)
        fetchJobs()
      }
    } catch (error) {
      console.error('Error retesting job:', error)
    } finally {
      setRetestLoading(false)
    }
  }

  const handleDetail = (job: QueueJob) => {
    setSelectedJob(job)
    setShowDetailModal(true)
    setActionDropdown(null)
  }

  const exportToCSV = () => {
    const headers = ['#', 'Task', 'Device S/N', 'Regional', 'Type', 'Test', 'Status', 'Last Run']
    const rows = jobs.map((job, index) => [
      (page - 1) * 10 + index + 1,
      job.task_title || '-',
      job.serial_number || '-',
      job.region_name || job.regional_code || '-',
      job.execution_type,
      job.test_type || '-',
      job.status,
      new Date(job.created_at).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Jakarta'
      })
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `queue_jobs_export_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    }
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
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
        hour12: false
      }).format(date)
    } else {
      // Different day: show "May 17, 2026, 06:37" format
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(date)
    }
  }

  return (
    <div className="min-h-screen p-8 bg-white/90 dark:bg-gray-800/90">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Queueing</h1>
        {(userRole === 'admin' || userRole === 'Administrator' || userRole === 'Admin') && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowClearRecentConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Clear Recent Jobs
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete All
            </button>
          </div>
        )}
      </div>

      {/* Statistics Cards */}
      {!loadingStatistics && statistics && (
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Total Tests (24h)</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{statistics.total?.total_tests || 0}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Success</p>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">{statistics.total?.success_count || 0}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Failed</p>
            <p className="text-3xl font-bold text-red-600 dark:text-red-400">{statistics.total?.failed_count || 0}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Pending</p>
            <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{statistics.total?.pending_count || 0}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Processing</p>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{statistics.total?.processing_count || 0}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Devices Tested</p>
            <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{statistics.total?.device_count || 0}</p>
          </div>
        </div>
      )}

      {/* Test Type Breakdown */}
      {!loadingStatistics && statistics && statistics.by_type && statistics.by_type.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Test Type Breakdown (24 Hours)</h3>
          <div className="flex flex-wrap gap-3">
            {statistics.by_type.map((type: any) => {
              const successRate = type.total > 0 ? (type.success / type.total) * 100 : 0
              let cardColor = 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700'
              if (successRate < 50) {
                cardColor = 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700'
              } else if (successRate < 80) {
                cardColor = 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700'
              }
              return (
                <div 
                  key={type.test_type} 
                  className={`${cardColor} rounded-lg px-4 py-2 border cursor-pointer hover:opacity-80 transition-opacity`}
                  onClick={() => {
                    setSelectedTestType(type)
                    setShowTestTypeModal(true)
                  }}
                >
                  <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                    {type.test_type} (Success rate {successRate.toFixed(1)}%)
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Top 5 Failed Devices */}
      {!loadingStatistics && statistics && statistics.top_failed_devices && statistics.top_failed_devices.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top 5 Devices with Most Failures (24 Hours)</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Serial Number</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Indihome ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Region (TSEL)</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Total Tests</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Failed</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {statistics.top_failed_devices.map((device: any, index: number) => (
                  <tr key={device.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{index + 1}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <button
                        onClick={() => {
                          setSelectedDeviceForFailures(device)
                          setShowDeviceFailuresModal(true)
                          fetchDeviceFailures(device.id)
                        }}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer"
                      >
                        {device.serial_number || '-'}
                      </button>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{device.indihome_id || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{device.region_name || device.regional_code || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{device.total_tests || 0}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-red-600 dark:text-red-400">{device.failed_count || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-visible">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-4 items-center flex-wrap">
            <div className="w-64">
              <select
                value={selectedTask}
                onChange={(e) => {
                  setSelectedTask(e.target.value)
                  setPage(1)
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">All Tasks</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id.toString()}>
                    {task.title} ({task.task_type})
                  </option>
                ))}
              </select>
            </div>
            <div className="w-64">
              <select
                value={selectedRegional}
                onChange={(e) => {
                  setSelectedRegional(e.target.value)
                  setPage(1)
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">All Regionals</option>
                {regionals.map((regional) => (
                  <option key={regional.id} value={regional.id.toString()}>
                    {regional.code}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-64">
              <select
                value={selectedDevice}
                onChange={(e) => {
                  setSelectedDevice(e.target.value)
                  setPage(1)
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">All Devices</option>
                {devices.map((device) => (
                  <option key={device.id} value={device.id.toString()}>
                    {device.serial_number} ({device.indihome_id})
                  </option>
                ))}
              </select>
            </div>
            <div className="w-48">
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value)
                  setPage(1)
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-600 dark:text-gray-400">
            Loading...
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-8 text-center text-gray-600 dark:text-gray-400">
            No queue jobs found
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">#</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Task</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Device S/N</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Region (TSEL)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Test</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Last Run</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {jobs.map((job, index) => (
                <tr key={job.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {(page - 1) * 10 + index + 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {job.task_title || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {job.serial_number || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {job.region_name || job.regional_code || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {job.execution_type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {job.test_type || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(job.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {formatRelativeTime(job.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white relative">
                    <div className="relative">
                      <button
                        onClick={() => setActionDropdown(actionDropdown === job.id ? null : job.id)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {actionDropdown === job.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-10 border border-gray-200 dark:border-gray-700">
                          <button
                            onClick={() => handleDetail(job)}
                            className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <Eye className="w-4 h-4" />
                            Detail
                          </button>
                          {userRole !== 'viewer' && userRole !== 'User' && (
                            <button
                              onClick={() => handleRetest(job.id)}
                              disabled={retestLoading}
                              className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                            >
                              <RefreshCw className={`w-4 h-4 ${retestLoading ? 'animate-spin' : ''}`} />
                              Retest
                            </button>
                          )}
                          {(userRole === 'admin' || userRole === 'Administrator' || userRole === 'Admin') && (
                            <button
                              onClick={() => {
                                setSelectedJobId(job.id)
                                setShowDeleteSingleConfirm(true)
                                setActionDropdown(null)
                              }}
                              className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
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

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete All Queue Jobs</h3>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete all queue jobs? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteLoading}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={deleteLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteLoading ? 'Deleting...' : 'Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showClearRecentConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Clear Recent Jobs</h3>
              <button
                onClick={() => setShowClearRecentConfirm(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Clear all pending jobs from queue and reset the worker queue? Job yang sedang diproses tidak akan terhapus.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowClearRecentConfirm(false)}
                disabled={clearRecentLoading}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleClearRecent}
                disabled={clearRecentLoading}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {clearRecentLoading ? 'Clearing...' : 'Clear Recent Jobs'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteSingleConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Queue Job</h3>
              <button
                onClick={() => setShowDeleteSingleConfirm(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete this queue job?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteSingleConfirm(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSingle}
                disabled={deleteLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
              >
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetailModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Queue Job Details</h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">ID</label>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedJob.id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
                  <div>{getStatusBadge(selectedJob.status)}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Task</label>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedJob.task_title || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Device S/N</label>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedJob.serial_number || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Region (TSEL)</label>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedJob.region_name || selectedJob.regional_code || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Execution Type</label>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedJob.execution_type}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Test Type</label>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedJob.test_type || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Last Run</label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {new Date(selectedJob.created_at).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                      timeZone: 'Asia/Jakarta'
                    })}
                  </p>
                </div>
                {selectedJob.last_error && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Last Error</label>
                    <p className="text-sm text-red-600 dark:text-red-400 break-words">{selectedJob.last_error}</p>
                  </div>
                )}
                {selectedJob.raw_response && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Response</label>
                    <pre className="text-xs text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 p-3 rounded-lg overflow-x-auto">
                      {typeof selectedJob.raw_response === 'string' 
                        ? selectedJob.raw_response 
                        : JSON.stringify(selectedJob.raw_response, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test Type Detail Modal */}
      {showTestTypeModal && selectedTestType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Test Type Details</h3>
              <button
                onClick={() => {
                  setShowTestTypeModal(false)
                  setSelectedTestType(null)
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Test Type</label>
                <p className="text-sm text-gray-900 dark:text-white capitalize">{selectedTestType.test_type}</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Total</label>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedTestType.total || 0}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Success</label>
                  <p className="text-sm text-green-600 dark:text-green-400">{selectedTestType.success || 0}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Failed</label>
                  <p className="text-sm text-red-600 dark:text-red-400">{selectedTestType.failed || 0}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Pending</label>
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">{selectedTestType.pending || 0}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Processing</label>
                  <p className="text-sm text-blue-600 dark:text-blue-400">{selectedTestType.processing || 0}</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Success Rate</label>
                <p className="text-sm text-gray-900 dark:text-white">
                  {selectedTestType.total > 0 ? ((selectedTestType.success / selectedTestType.total) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Device Failures Modal */}
      {showDeviceFailuresModal && selectedDeviceForFailures && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Device Failed Test Details</h3>
              <button
                onClick={() => {
                  setShowDeviceFailuresModal(false)
                  setSelectedDeviceForFailures(null)
                  setDeviceFailures([])
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Serial Number</label>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedDeviceForFailures.serial_number || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Indihome ID</label>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedDeviceForFailures.indihome_id || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Region (TSEL)</label>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedDeviceForFailures.region_name || selectedDeviceForFailures.regional_code || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Failed Count (24h)</label>
                  <p className="text-sm text-red-600 dark:text-red-400">{selectedDeviceForFailures.failed_count || 0}</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Failed Test Types</label>
                {loadingDeviceFailures ? (
                  <div className="text-center text-gray-500 dark:text-gray-400 py-4">Loading...</div>
                ) : deviceFailures.length > 0 ? (
                  <div className="space-y-2">
                    {deviceFailures.map((failure: any) => (
                      <div key={failure.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">{failure.test_type || 'Unknown'}</p>
                            {failure.task_title && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{failure.task_title}</p>
                            )}
                            {failure.last_error && (
                              <p className="text-xs text-red-600 dark:text-red-400 mt-2 break-words">{failure.last_error}</p>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 ml-4 whitespace-nowrap">
                            {new Date(failure.created_at).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 dark:text-gray-400 py-4">No failed tests in the last 24 hours</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function QueueingPageWrapper() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <QueueingPage />
    </Suspense>
  )
}

export default QueueingPageWrapper
export const dynamic = 'force-dynamic'
