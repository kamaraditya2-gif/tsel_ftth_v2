'use client'

import { useEffect, useState, useMemo } from 'react'
import OntArchitectureDiagram from '@/components/OntArchitectureDiagram'
import NetworkOverviewHeader from '@/components/NetworkOverviewHeader'
import { Search, Download } from 'lucide-react'

interface QueueResult {
  id: number
  queue_job_id: string
  device_id: number
  indihome_id: string | null
  serial_number: string | null
  regional_code: string | null
  region_name: string | null
  task_name: string | null
  speed_name: string | null
  ping_igw: number | null
  ping_ebr: number | null
  traceroute_raw: any
  download_speed: number | null
  upload_speed: number | null
  download_threshold: number | null
  upload_threshold: number | null
  packet_loss_igw: number | null
  packet_loss_ebr: number | null
  success: boolean
  error_message: string | null
  executed_at: string
  test_types: string[] | null
}

export default function TestResultPage() {
  const [results, setResults] = useState<QueueResult[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedResult, setSelectedResult] = useState<QueueResult | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showAllHops, setShowAllHops] = useState(false)
  const [selectedTab, setSelectedTab] = useState('ping') // 'ping', 'traceroute', 'speed_upload', 'speed_download'
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false)
  const [deleteAllLoading, setDeleteAllLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchResults()
  }, [page, selectedTab])

  const handleDelete = async () => {
    if (!selectedResult) return

    try {
      const response = await fetch(`/api/test-results/${selectedResult.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setShowModal(false)
        setShowDeleteConfirm(false)
        fetchResults()
      } else {
        console.error('Failed to delete test result')
      }
    } catch (error) {
      console.error('Error deleting test result:', error)
    }
  }

  const fetchResults = async () => {
    try {
      const response = await fetch(`/api/queue-results?page=${page}&limit=10&test_type=${selectedTab}`)
      const data = await response.json()
      setResults(data.data)
      setTotalPages(data.pagination.totalPages)
    } catch (error) {
      console.error('Error fetching queue results:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTabChange = (tab: string) => {
    setSelectedTab(tab)
    setPage(1) // Reset to page 1 when tab changes
  }

  const handleDeleteAll = async () => {
    setDeleteAllLoading(true)
    try {
      const response = await fetch(`/api/test-results/delete-all?test_type=${selectedTab}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setShowDeleteAllConfirm(false)
        setPage(1)
        fetchResults()
      } else {
        const data = await response.json()
        console.error('Failed to delete all test results:', data.error)
      }
    } catch (error) {
      console.error('Error deleting all test results:', error)
    } finally {
      setDeleteAllLoading(false)
    }
  }

  const filteredResults = useMemo(() => {
    if (!searchTerm) return results
    const term = searchTerm.toLowerCase()
    return results.filter(r =>
      (r.serial_number && r.serial_number.toLowerCase().includes(term)) ||
      (r.indihome_id && r.indihome_id.toLowerCase().includes(term)) ||
      (r.regional_code && r.regional_code.toLowerCase().includes(term)) ||
      (r.speed_name && r.speed_name.toLowerCase().includes(term)) ||
      (r.task_name && r.task_name.toLowerCase().includes(term))
    )
  }, [results, searchTerm])

  const exportToCSV = () => {
    const headers = ['#', 'Device S/N', 'Indihome ID', 'Regional', 'Status', 'Tested At']
    const rows = filteredResults.map((r, i) => [
      String((page - 1) * 10 + i + 1),
      r.serial_number || '',
      r.indihome_id || '',
      r.regional_code || '',
      r.success ? 'Success' : 'Failed',
      r.executed_at || ''
    ])
    const csv = [headers.join(','), ...rows.map(row => row.map(c => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `test-results-${selectedTab}-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const countHops = (tracerouteRaw: any): number => {
    if (!tracerouteRaw) return 0
    
    try {
      // If already an object/array
      if (typeof tracerouteRaw === 'object') {
        if (Array.isArray(tracerouteRaw)) {
          return tracerouteRaw.length
        }
        return Object.keys(tracerouteRaw).length
      }
      // If string, try to parse as JSON
      const parsed = JSON.parse(tracerouteRaw)
      if (Array.isArray(parsed)) {
        return parsed.length
      }
      if (typeof parsed === 'object') {
        return Object.keys(parsed).length
      }
    } catch (e) {
      // If not JSON, try to count by splitting
      if (typeof tracerouteRaw === 'string') {
        if (tracerouteRaw.includes(',')) {
          return tracerouteRaw.split(',').filter(h => h.trim()).length
        }
        // Count by spaces or other delimiters
        return tracerouteRaw.split(/\s+/).filter(h => h.trim()).length
      }
    }
    
    return 0
  }

  const parseTraceroute = (tracerouteRaw: any): Array<{hop: number, ip: string, rtt: string}> => {
    if (!tracerouteRaw) return []

    try {
      // If already an object/array
      if (typeof tracerouteRaw === 'object') {
        if (Array.isArray(tracerouteRaw)) {
          return tracerouteRaw.map((h: any) => ({
            hop: h.hop_no || h.hop || 0,
            ip: h.address || h.ip || h.hostname || '-',
            rtt: h.rt_times || h.rtt || h.latency || '-'
          }))
        }
        return Object.entries(tracerouteRaw).map(([key, value]: [string, any]) => ({
          hop: parseInt(key) || value.hop_no || value.hop || 0,
          ip: value.address || value.ip || value.hostname || '-',
          rtt: value.rt_times || value.rtt || value.latency || '-'
        }))
      }
      // If string, try to parse as JSON
      const parsed = JSON.parse(tracerouteRaw)
      if (Array.isArray(parsed)) {
        return parsed.map((h: any) => ({
          hop: h.hop_no || h.hop || 0,
          ip: h.address || h.ip || h.hostname || '-',
          rtt: h.rt_times || h.rtt || h.latency || '-'
        }))
      }
      if (typeof parsed === 'object') {
        return Object.entries(parsed).map(([key, value]: [string, any]) => ({
          hop: parseInt(key) || value.hop_no || value.hop || 0,
          ip: value.address || value.ip || value.hostname || '-',
          rtt: value.rt_times || value.rtt || value.latency || '-'
        }))
      }
    } catch (e) {
      // If not JSON, return empty
      return []
    }

    return []
  }

  const calculateTotalRTT = (tracerouteRaw: any): number => {
    const hops = parseTraceroute(tracerouteRaw)
    return hops.reduce((total: number, hop: any) => {
      const rtt = parseFloat(hop.rtt.replace('ms', '')) || 0
      return total + rtt
    }, 0)
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
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Performance Test</h1>
        <button
          onClick={() => setShowDeleteAllConfirm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
        >
          Delete All
        </button>
      </div>

      <NetworkOverviewHeader />

      {/* Tabs */}
      <div className="mb-4">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'ping', label: 'Latency' },
              { id: 'traceroute', label: 'Traceroute' },
              { id: 'speed_upload', label: 'Speed Upload' },
              { id: 'speed_download', label: 'Speed Download' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`${
                  selectedTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Search & Export */}
      <div className="mb-4 flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by S/N, Indihome ID, Region..."
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setPage(1) }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-6 text-gray-600 dark:text-gray-400">Loading...</div>
        ) : (
          <table className="min-w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">#</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">DEVICE S/N</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">REGIONAL</th>
                {selectedTab === 'speed_upload' || selectedTab === 'speed_download' ? (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">SPEED</th>
                ) : null}
                {selectedTab === 'ping' ? (
                  <>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">near IGW Latency (ms)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">near IGW Packet Loss (%)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">near EBR Latency (ms)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">near EBR Packet Loss (%)</th>
                  </>
                ) : null}
                {selectedTab === 'traceroute' ? (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Traceroute Hops</th>
                ) : null}
                {selectedTab === 'speed_upload' ? (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Upload (<span className="normal-case">Mbps</span>)</th>
                ) : null}
                {selectedTab === 'speed_download' ? (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Download (<span className="normal-case">Mbps</span>)</th>
                ) : null}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Tested At</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={selectedTab === 'ping' ? 8 : selectedTab === 'traceroute' ? 5 : selectedTab === 'speed_upload' || selectedTab === 'speed_download' ? 7 : 6} className="px-6 py-4 text-center text-sm text-gray-600 dark:text-gray-400">
                    {searchTerm ? 'No results match your search' : 'No test results available'}
                  </td>
                </tr>
              ) : (
                filteredResults.map((result, index) => (
                  <tr key={result.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{(page - 1) * 10 + index + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                        onClick={() => {
                          setSelectedResult(result)
                          setShowModal(true)
                        }}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900 dark:text-white">{result.serial_number || '-'}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{result.indihome_id || '-'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {result.region_name || result.regional_code || '-'}
                    </td>
                    {selectedTab === 'speed_upload' || selectedTab === 'speed_download' ? (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {result.speed_name || '-'}
                      </td>
                    ) : null}
                    {selectedTab === 'ping' ? (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {result.ping_igw !== null ? Number(result.ping_igw).toFixed(2) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {result.packet_loss_igw !== null ? Number(result.packet_loss_igw).toFixed(2) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {result.ping_ebr !== null ? Number(result.ping_ebr).toFixed(2) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {result.packet_loss_ebr !== null ? Number(result.packet_loss_ebr).toFixed(2) : '-'}
                        </td>
                      </>
                    ) : null}
                    {selectedTab === 'traceroute' ? (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {countHops(result.traceroute_raw) > 0 ? countHops(result.traceroute_raw) : '-'}
                      </td>
                    ) : null}
                    {selectedTab === 'speed_upload' ? (
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {result.upload_speed !== null ? (
                          <span className={result.upload_threshold && Number(result.upload_speed) < Number(result.upload_threshold) ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-500 dark:text-gray-400'}>
                            {Number(result.upload_speed).toFixed(2)}
                          </span>
                        ) : '-'}
                      </td>
                    ) : null}
                    {selectedTab === 'speed_download' ? (
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {result.download_speed !== null ? (
                          <span className={result.download_threshold && Number(result.download_speed) < Number(result.download_threshold) ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-500 dark:text-gray-400'}>
                            {Number(result.download_speed).toFixed(2)}
                          </span>
                        ) : '-'}
                      </td>
                    ) : null}
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        result.success
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {result.success ? 'Success' : 'Failed'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatRelativeTime(result.executed_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
        {filteredResults.length > 0 && (
          <div className="bg-white dark:bg-gray-800 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Showing {((page - 1) * 10) + 1} to {Math.min(page * 10, (filteredResults.length || 0) + ((page - 1) * 10))} of {filteredResults.length} results
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Page {page} of {Math.ceil(filteredResults.length / 10)}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === Math.ceil(filteredResults.length / 10)}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showModal && selectedResult && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 px-8 py-6">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-white">Test Results Details</h2>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      selectedResult.success
                        ? 'bg-green-500/20 text-green-100 border border-green-400/30'
                        : 'bg-red-500/20 text-red-100 border border-red-400/30'
                    }`}>
                      {selectedResult.success ? 'Success' : 'Failed'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-white/80 hover:text-white hover:bg-white/20 rounded-lg p-2 transition-all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar" style={{
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(156, 163, 175, 0.5) rgba(0, 0, 0, 0.05)'
            }}>
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
              {/* Test Types Badges */}
              {selectedResult.test_types && selectedResult.test_types.length > 0 && (
                <div className="mb-6">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Test Types</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedResult.test_types.map((type) => {
                      const badgeColors: Record<string, string> = {
                        ping: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
                        traceroute: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
                        download: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
                        upload: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
                        'ont-status': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                      };
                      return (
                        <span
                          key={type}
                          className={`px-3 py-1.5 text-xs font-medium rounded-full ${badgeColors[type] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}`}
                        >
                          {type}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* Metrics Grid - Only show for ping tab */}
              {selectedTab === 'ping' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className={`bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border ${
                  selectedResult.ping_igw !== null && selectedResult.ping_igw > 100
                    ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
                    : 'border-gray-200 dark:border-gray-600'
                }`}>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">near IGW Latency</p>
                  <p className={`text-2xl font-bold ${
                    selectedResult.ping_igw !== null && Number(selectedResult.ping_igw) > 100
                      ? 'text-red-700 dark:text-red-400'
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {selectedResult.ping_igw !== null ? Number(selectedResult.ping_igw).toFixed(2) : '-'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">ms</p>
                </div>
                <div className={`bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border ${
                  selectedResult.packet_loss_igw !== null && Number(selectedResult.packet_loss_igw) > 10
                    ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
                    : 'border-gray-200 dark:border-gray-600'
                }`}>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">near IGW Packet Loss</p>
                  <p className={`text-2xl font-bold ${
                    selectedResult.packet_loss_igw !== null && Number(selectedResult.packet_loss_igw) > 10
                      ? 'text-red-700 dark:text-red-400'
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {selectedResult.packet_loss_igw !== null ? Number(selectedResult.packet_loss_igw).toFixed(2) : '-'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">%</p>
                </div>
                <div className={`bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border ${
                  selectedResult.ping_ebr !== null && Number(selectedResult.ping_ebr) > 100
                    ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
                    : 'border-gray-200 dark:border-gray-600'
                }`}>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">near EBR Latency</p>
                  <p className={`text-2xl font-bold ${
                    selectedResult.ping_ebr !== null && Number(selectedResult.ping_ebr) > 100
                      ? 'text-red-700 dark:text-red-400'
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {selectedResult.ping_ebr !== null ? Number(selectedResult.ping_ebr).toFixed(2) : '-'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">ms</p>
                </div>
                <div className={`bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border ${
                  selectedResult.packet_loss_ebr !== null && Number(selectedResult.packet_loss_ebr) > 10
                    ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
                    : 'border-gray-200 dark:border-gray-600'
                }`}>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">near EBR Packet Loss</p>
                  <p className={`text-2xl font-bold ${
                    selectedResult.packet_loss_ebr !== null && Number(selectedResult.packet_loss_ebr) > 10
                      ? 'text-red-700 dark:text-red-400'
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {selectedResult.packet_loss_ebr !== null ? Number(selectedResult.packet_loss_ebr).toFixed(2) : '-'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">%</p>
                </div>
              </div>
              )}

              {/* Device Info - Show for all tabs except traceroute */}
              {selectedTab !== 'traceroute' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Device S/N</p>
                  <div className="flex flex-col">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedResult.serial_number || '-'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{selectedResult.indihome_id || '-'}</p>
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Regional</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedResult.regional_code || '-'}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Speed</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedResult.speed_name || '-'}</p>
                </div>
              </div>
              )}

              {/* Futuristic Architecture Diagram for ping test */}
              {selectedTab === 'ping' && (
                <OntArchitectureDiagram
                  serialNumber={selectedResult.serial_number}
                  pingIgw={selectedResult.ping_igw !== null ? Number(selectedResult.ping_igw) : null}
                  pingEbr={selectedResult.ping_ebr !== null ? Number(selectedResult.ping_ebr) : null}
                  status={selectedResult.success ? 'online' : 'offline'}
                />
              )}

              {/* Traceroute Topology */}
              {selectedResult.traceroute_raw && (
                <div className="mb-6">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wide">Trace Route</p>
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-2xl p-6 border border-gray-200 dark:border-gray-600 shadow-inner">
                    {/* Horizontal Flow */}
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      {(() => {
                        const hops = parseTraceroute(selectedResult.traceroute_raw)
                        
                        if (hops.length === 0) {
                          return <span className="text-sm text-gray-500 dark:text-gray-400">No traceroute data available</span>
                        }
                        
                        // Determine which hops to display
                        const maxHopsToShow = 30
                        const shouldTruncate = hops.length > maxHopsToShow && !showAllHops
                        
                        let hopsToDisplay = hops
                        if (shouldTruncate) {
                          hopsToDisplay = [
                            ...hops.slice(0, 5),
                            { hop: -1, ip: '...', rtt: '' },
                            ...hops.slice(-5)
                          ]
                        }
                        
                        return hopsToDisplay.map((hop, index) => (
                          <div key={hop.hop} className="flex items-center">
                            {/* Hop Node */}
                            {hop.hop === -1 ? (
                              <div className="text-gray-400 dark:text-gray-500 px-2">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                              </div>
                            ) : (
                              <div className="bg-white dark:bg-gray-800 rounded-lg px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm">
                                <span className="text-sm font-mono text-gray-900 dark:text-white">
                                  {hop.ip}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                  {hop.rtt}
                                </span>
                              </div>
                            )}
                            {/* Arrow */}
                            {index < hopsToDisplay.length - 1 && hop.hop !== -1 && (
                              <svg className="w-6 h-6 text-gray-400 dark:text-gray-500 mx-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                            )}
                          </div>
                        ))
                      })()}
                    </div>
                    {/* Show More/Less Button */}
                    {(() => {
                      const hops = parseTraceroute(selectedResult.traceroute_raw)
                      if (hops.length > 30) {
                        return (
                          <button
                            onClick={() => setShowAllHops(!showAllHops)}
                            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                          >
                            {showAllHops ? `Show less (30 of ${hops.length})` : `Show all ${hops.length} hops`}
                          </button>
                        )
                      }
                      return null
                    })()}
                    {/* Total RTT */}
                    <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Total RTT: <span className="text-blue-600 dark:text-blue-400">{calculateTotalRTT(selectedResult.traceroute_raw).toFixed(0)}ms</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Task & Tested At */}
              <div className="mb-6">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Task</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {selectedResult.task_name || '-'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Tested At</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {selectedResult.executed_at ? new Date(selectedResult.executed_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: false,
                          timeZone: 'Asia/Jakarta'
                        }) : '-'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {selectedResult.error_message && (
                <div className="mb-6">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">Error Message</p>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-700 dark:text-red-400">{selectedResult.error_message}</p>
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="bg-gray-50 dark:bg-gray-700/50 px-8 py-4 border-t border-gray-200 dark:border-gray-600">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium"
                >
                  Delete
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Delete Test Result</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete this test result? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Confirmation Modal */}
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Delete All Test Results</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete all {selectedTab} test results? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteAllConfirm(false)}
                disabled={deleteAllLoading}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={deleteAllLoading}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium disabled:opacity-50"
              >
                {deleteAllLoading ? 'Deleting...' : 'Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
