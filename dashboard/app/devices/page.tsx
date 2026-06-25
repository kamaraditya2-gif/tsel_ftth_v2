'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { MoreVertical, Eye, Edit, Trash2, Search, Download, Zap, Plus } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import OntArchitectureDiagram from '@/components/OntArchitectureDiagram'
import NetworkOverviewHeader from '@/components/NetworkOverviewHeader'
import InlineAlias from '@/components/InlineAlias'
import LocationFilter from '@/components/LocationFilter'

export const dynamic = 'force-dynamic'

interface Group {
  id: number
  name: string
  code: string | null
}

interface SpeedGroup {
  id: number
  name: string
  speed_limit: number | null
  upload_threshold: number | null
  download_threshold: number | null
}

interface Manufacturer {
  id: number
  name: string
}

interface OntModel {
  id: number
  name: string
  manufacturer_id: number | null
}

interface Device {
  id: number
  device_name: string
  serial_number: string
  mac_address: string | null
  ip_address: string | null
  status: string
  group_id: number | null
  speed_id: number | null
  indihome_id: string | null
  cpe_type: string | null
  manufacturer: string | null
  model: string | null
  alias_device: string | null
  lat: number | null
  lng: number | null
  group_name: string | null
  speed_name: string | null
  downstream_server_id: number | null
  region_name: string | null
  region_province: string | null
  area_id: number | null
  cluster_nop_id: number | null
  avg_ping: number | null
  success_rate: number | null
}

function DevicesPageContent() {
  const searchParams = useSearchParams()
  const [devices, setDevices] = useState<Device[]>([])
  const [filteredDevices, setFilteredDevices] = useState<Device[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [speedGroups, setSpeedGroups] = useState<SpeedGroup[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [downstreamServers, setDownstreamServers] = useState<any[]>([])
  const [ontModels, setOntModels] = useState<OntModel[]>([])
  const [areas, setAreas] = useState<any[]>([])
  const [nopClusters, setNopClusters] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<number | 'none' | null>(null)
  const [selectedSpeed, setSelectedSpeed] = useState<number | 'none' | null>(null)
  const [selectedRegion, setSelectedRegion] = useState<number | 'none' | null>(null)
  const [selectedManufacturer, setSelectedManufacturer] = useState<string | null>(null)
  const [selectedArea, setSelectedArea] = useState<number | null>(null)
  const [selectedNopCity, setSelectedNopCity] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editFormData, setEditFormData] = useState({
    device_name: '',
    serial_number: '',
    mac_address: '',
    ip_address: '',
    group_id: null as number | null,
    speed_id: null as number | null,
    indihome_id: '',
    cpe_type: '',
    manufacturer_id: null as number | null,
    ont_model_id: null as number | null,
    status: '',
    lat: '' as string,
    lng: '' as string,
    downstream_server_id: null as number | null,
    area_id: null as number | null,
    cluster_nop_id: null as number | null,
  })
  const [addFormData, setAddFormData] = useState({
    device_name: '',
    serial_number: '',
    mac_address: '',
    ip_address: '',
    group_id: null as number | null,
    speed_id: null as number | null,
    indihome_id: '',
    cpe_type: '',
    manufacturer_id: null as number | null,
    ont_model_id: null as number | null,
    status: 'online',
    lat: '' as string,
    lng: '' as string,
    downstream_server_id: null as number | null,
    area_id: null as number | null,
    cluster_nop_id: null as number | null,
  })
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null)
  const [successMsg, setSuccessMsg] = useState('')
  const [showOnDemandTestModal, setShowOnDemandTestModal] = useState(false)
  const [onDemandTestDevice, setOnDemandTestDevice] = useState<Device | null>(null)
  const [selectedTestTypes, setSelectedTestTypes] = useState({
    ping: false,
    traceroute: false,
    upload: false,
    download: false
  })
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState<{ top: boolean; bottom: boolean }>({ top: false, bottom: true })
  const dropdownRefs = useRef<{ [key: number]: HTMLDivElement | null }>({})
  const buttonRefs = useRef<{ [key: number]: HTMLButtonElement | null }>({})
  const [lastTestResults, setLastTestResults] = useState<any>(null)
  const [loadingTestResults, setLoadingTestResults] = useState(false)
  const [showAllHops, setShowAllHops] = useState(false)
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
    fetchDevices()
    fetchGroups()
    fetchSpeedGroups()
    fetchManufacturers()
    fetchOntModels()
    fetchUserRole()
    fetchDownstreamServers()
    fetchAreas()
    fetchAllNopClusters()
    
    // Read group from URL query parameter
    const groupParam = searchParams.get('group')
    if (groupParam) {
      setSelectedGroup(parseInt(groupParam))
    }
    
    // Read speed from URL query parameter
    const speedParam = searchParams.get('speed')
    if (speedParam) {
      setSelectedSpeed(parseInt(speedParam))
    }

    // Read region from URL query parameter
    const regionParam = searchParams.get('region')
    if (regionParam) {
      setSelectedRegion(parseInt(regionParam))
    }
  }, [searchParams])

  const fetchGroups = async () => {
    try {
      const res = await fetch('/api/group-devices')
      const data = await res.json()
      if (Array.isArray(data)) {
        setGroups(data)
      } else {
        console.error('Unexpected groups response:', data)
        setGroups([])
      }
    } catch (error) {
      console.error('Failed to fetch groups:', error)
      setGroups([])
    }
  }

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
    } catch (error) {
      console.error('Failed to fetch speed groups:', error)
      setSpeedGroups([])
    }
  }

  const fetchManufacturers = async () => {
    try {
      const res = await fetch('/api/manufacturer')
      const data = await res.json()
      if (Array.isArray(data)) {
        setManufacturers(data)
      } else {
        console.error('Unexpected manufacturers response:', data)
        setManufacturers([])
      }
    } catch (error) {
      console.error('Failed to fetch manufacturers:', error)
      setManufacturers([])
    }
  }

  const fetchOntModels = async () => {
    try {
      const res = await fetch('/api/ont-model')
      const data = await res.json()
      if (Array.isArray(data)) {
        setOntModels(data)
      } else {
        console.error('Unexpected ont models response:', data)
        setOntModels([])
      }
    } catch (error) {
      console.error('Failed to fetch ont models:', error)
      setOntModels([])
    }
  }

  const fetchDownstreamServers = async () => {
    try {
      const res = await fetch('/api/downstream-servers')
      const data = await res.json()
      setDownstreamServers(data.servers || [])
    } catch (error) {
      console.error('Failed to fetch downstream servers:', error)
      setDownstreamServers([])
    }
  }

  const fetchAreas = async () => {
    try {
      const res = await fetch('/api/master-area')
      const data = await res.json()
      if (Array.isArray(data)) {
        setAreas(data)
      } else {
        console.error('Unexpected areas response:', data)
        setAreas([])
      }
    } catch (error) {
      console.error('Failed to fetch areas:', error)
      setAreas([])
    }
  }

  const fetchNopClusters = async (areaId: number | null, regionalId: number | null) => {
    try {
      if (!areaId || !regionalId) {
        setNopClusters([])
        return
      }
      const res = await fetch(`/api/master-cluster-nop?area_id=${areaId}&regional_id=${regionalId}`)
      const data = await res.json()
      if (Array.isArray(data)) {
        setNopClusters(data)
      } else {
        console.error('Unexpected nop clusters response:', data)
        setNopClusters([])
      }
    } catch (error) {
      console.error('Failed to fetch nop clusters:', error)
      setNopClusters([])
    }
  }

  const fetchAllNopClusters = async () => {
    try {
      const res = await fetch('/api/master-cluster-nop')
      const data = await res.json()
      if (Array.isArray(data)) {
        setNopClusters(data)
      }
    } catch (error) {
      console.error('Failed to fetch all nop clusters:', error)
    }
  }

  const fetchDevices = async () => {
    try {
      const res = await fetch('/api/devices')
      const data = await res.json()
      if (Array.isArray(data)) {
        setDevices(data)
        setFilteredDevices(data)
      } else {
        console.error('Unexpected devices response:', data)
        setDevices([])
        setFilteredDevices([])
      }
    } catch (error) {
      console.error('Error fetching devices:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let filtered = devices

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(device =>
        device.device_name.toLowerCase().includes(term) ||
        device.serial_number.toLowerCase().includes(term) ||
        device.indihome_id?.toLowerCase().includes(term) ||
        device.ip_address?.toLowerCase().includes(term)
      )
    }

    if (selectedGroup !== null) {
      if (selectedGroup === 'none') {
        filtered = filtered.filter(device => device.group_id === null)
      } else {
        filtered = filtered.filter(device => device.group_id === selectedGroup)
      }
    }

    if (selectedSpeed !== null) {
      if (selectedSpeed === 'none') {
        filtered = filtered.filter(device => device.speed_id === null)
      } else {
        filtered = filtered.filter(device => device.speed_id === selectedSpeed)
      }
    }

    if (selectedRegion !== null) {
      if (selectedRegion === 'none') {
        filtered = filtered.filter(device => device.downstream_server_id === null)
      } else {
        filtered = filtered.filter(device => device.downstream_server_id === selectedRegion)
      }
    }

    if (selectedManufacturer !== null) {
      filtered = filtered.filter(device => device.manufacturer === selectedManufacturer)
    }

    if (selectedArea !== null) {
      const areaNopIds = nopClusters.filter(n => n.area_id === selectedArea).map(n => n.id)
      filtered = filtered.filter(device => device.cluster_nop_id === null || areaNopIds.includes(device.cluster_nop_id))
    }

    if (selectedNopCity !== null) {
      filtered = filtered.filter(device => device.cluster_nop_id === selectedNopCity)
    }

    setFilteredDevices(filtered)
    setCurrentPage(1)
  }, [searchTerm, selectedGroup, selectedSpeed, selectedRegion, selectedManufacturer, selectedArea, selectedNopCity, devices, nopClusters])

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jakarta'
    })
  }

  const exportToCSV = () => {
    const headers = ['Device Name', 'Serial Number', 'IP Address', 'Model', 'Indihome ID', 'Regional', 'Status']
    const rows = filteredDevices.map(device => [
      device.device_name,
      device.serial_number,
      device.ip_address || '',
      device.model || '',
      device.indihome_id || '',
      device.group_name || '',
      device.status
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `devices_export_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleUpdate = async () => {
    if (!selectedDevice) { alert('No device selected'); return }
    try {
      console.log('Saving device:', selectedDevice.id, editFormData)
      const res = await fetch(`/api/devices/${selectedDevice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData)
      })

      if (!res.ok) {
        const errText = await res.text()
        console.error('Failed to update device:', res.status, errText)
        alert('Error: ' + errText)
        return
      }

      await fetchDevices()
      setShowEditModal(false)
      setSelectedDevice(null)
      alert('Device saved successfully!')
      setSuccessMsg('Device updated successfully')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (error) {
      console.error('Error updating device:', error)
    }
  }

  const handleAdd = async () => {
    try {
      const res = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addFormData)
      })

      if (!res.ok) {
        console.error('Failed to add device')
        return
      }

      await fetchDevices()
      setShowAddModal(false)
      setSuccessMsg('Device added successfully')
      setTimeout(() => setSuccessMsg(''), 3000)
      setAddFormData({
        device_name: '',
        serial_number: '',
        mac_address: '',
        ip_address: '',
        group_id: null,
        speed_id: null,
        indihome_id: '',
        cpe_type: '',
        manufacturer_id: null,
        ont_model_id: null,
        status: 'online',
        lat: '',
        lng: '',
        downstream_server_id: null,
        area_id: null,
        cluster_nop_id: null
      })
    } catch (error) {
      console.error('Error adding device:', error)
    }
  }

  const handleDelete = async () => {
    if (!deviceToDelete) return

    try {
      const res = await fetch(`/api/devices/${deviceToDelete.id}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        console.error('Failed to delete device')
        return
      }

      await fetchDevices()
      setShowDeleteDialog(false)
      setDeviceToDelete(null)
    } catch (error) {
      console.error('Error deleting device:', error)
    }
  }

  const handleOnDemandTest = async (device: Device) => {
    setOnDemandTestDevice(device)
    setSelectedTestTypes({
      ping: true,
      traceroute: true,
      upload: true,
      download: true
    })
    setShowOnDemandTestModal(true)
    setOpenDropdownId(null)
  }

  const handleTestTypeChange = (type: keyof typeof selectedTestTypes) => {
    setSelectedTestTypes(prev => ({
      ...prev,
      [type]: !prev[type]
    }))
  }

  const handleConfirmStart = () => {
    setShowConfirmDialog(true)
  }

  const handleStartOnDemandTest = async () => {
    if (!onDemandTestDevice) return

    const selectedTypes = Object.entries(selectedTestTypes)
      .filter(([_, checked]) => checked)
      .map(([type, _]) => type)

    if (selectedTypes.length === 0) {
      alert('Please select at least one test type')
      return
    }

    // Get user ID from cookie
    let userId = null
    try {
      const cookies = document.cookie.split(';')
      const userSessionCookie = cookies.find(cookie => cookie.trim().startsWith('user_session='))
      if (userSessionCookie) {
        const sessionData = JSON.parse(decodeURIComponent(userSessionCookie.split('=')[1]))
        userId = sessionData.id
      }
    } catch (error) {
      console.error('Error parsing user session:', error)
    }

    const now = new Date().toISOString()

    try {
      for (const testType of selectedTypes) {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `On Demand Test ${onDemandTestDevice.serial_number}`,
            task_type: 'ondemand',
            test_type: testType,
            group_id: null,
            device_id: onDemandTestDevice.id,
            payload_id: null,
            cron_time: null,
            started_at: now,
            next_run: now,
            is_active: true,
            created_by: userId,
            created_at: now
          })
        })

        if (!res.ok) {
          console.error(`Failed to create on-demand test for ${testType}`)
        }
      }

      setShowOnDemandTestModal(false)
      setOnDemandTestDevice(null)
      setShowConfirmDialog(false)
    } catch (error) {
      console.error('Error creating on-demand test:', error)
      setShowConfirmDialog(false)
    }
  }

  const fetchLastTestResults = async (deviceId: number) => {
    try {
      setLoadingTestResults(true)
      const res = await fetch(`/api/queue-results?device_id=${deviceId}&limit=1`)
      const data = await res.json()
      setLastTestResults(data.data[0] || null)
    } catch (error) {
      console.error('Error fetching last test results:', error)
      setLastTestResults(null)
    } finally {
      setLoadingTestResults(false)
    }
  }

  const fetchHistoricalTestResults = async (deviceId: number) => {
    try {
      setLoadingHistoricalResults(true)
      
      // Fetch ping data for latency chart
      const pingRes = await fetch(`/api/queue-results?device_id=${deviceId}&test_type=ping&hours=24&limit=100`)
      const pingData = await pingRes.json()
      
      // Fetch upload data for speed chart
      const uploadRes = await fetch(`/api/queue-results?device_id=${deviceId}&test_type=speed_upload&hours=24&limit=100`)
      const uploadData = await uploadRes.json()
      
      // Fetch download data for speed chart
      const downloadRes = await fetch(`/api/queue-results?device_id=${deviceId}&test_type=speed_download&hours=24&limit=100`)
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

  const handleDropdownToggle = (deviceId: number) => {
    if (openDropdownId === deviceId) {
      setOpenDropdownId(null)
      return
    }

    const button = buttonRefs.current[deviceId]
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

    setOpenDropdownId(deviceId)
  }

  const getDropdownPosition = (deviceId: number) => {
    const button = buttonRefs.current[deviceId]
    if (!button) return 0
    const rect = button.getBoundingClientRect()
    if (dropdownPosition.top) {
      return rect.top - 120
    }
    return rect.bottom
  }

  const totalPages = Math.ceil(filteredDevices.length / itemsPerPage)
  const paginatedDevices = filteredDevices.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  return (
    <div className="min-h-screen p-8 bg-transparent">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Devices</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
        >
          <Plus className="w-4 h-4" />
          Add Device
        </button>
      </div>

      <NetworkOverviewHeader areaId={selectedArea} regionalId={selectedRegion === 'none' ? null : selectedRegion} nopId={selectedNopCity} />

      {/* Success Toast */}
      {successMsg && (
        <div className="fixed top-4 right-4 z-[100] bg-green-600 text-white px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold">
          ✅ {successMsg}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-visible">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search devices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <LocationFilter onFilterChange={(a,r,n) => { setSelectedArea(a); setSelectedRegion(r); setSelectedNopCity(n) }} />
            <select
              value={selectedSpeed === 'none' ? 'none' : (selectedSpeed || '')}
              onChange={(e) => {
                const value = e.target.value
                if (value === 'none') {
                  setSelectedSpeed('none')
                } else if (value === '') {
                  setSelectedSpeed(null)
                } else {
                  setSelectedSpeed(parseInt(value))
                }
              }}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All Speeds</option>
              {speedGroups.map((speed) => (
                <option key={speed.id} value={speed.id}>
                  {speed.name}
                </option>
              ))}
              <option value="none">No Speed</option>
            </select>
            <select
              value={selectedManufacturer || ''}
              onChange={(e) => setSelectedManufacturer(e.target.value || null)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All Brands</option>
              {devices.reduce<string[]>((acc, d) => {
                if (d.manufacturer && !acc.includes(d.manufacturer)) acc.push(d.manufacturer)
                return acc
              }, []).sort().map(brand => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
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
          <div className="p-6 text-gray-600 dark:text-gray-400">Loading...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Device Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Alias
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Serial Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  IP Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Model
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Indihome ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Speed
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Region (TSEL)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                {userRole !== 'viewer' && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedDevices.map((device) => (
                <tr key={device.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    <button
                      onClick={() => {
                        setSelectedDevice(device)
                        setShowDetailModal(true)
                        fetchLastTestResults(device.id)
                        fetchHistoricalTestResults(device.id)
                      }}
                      className="hover:underline cursor-pointer text-left"
                    >
                      {device.device_name}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <InlineAlias deviceId={device.id} value={device.alias_device || ''} onSave={() => fetchDevices()} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {device.serial_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {device.ip_address || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {device.model || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {device.indihome_id || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {device.speed_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {device.region_name || device.group_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      device.status === 'online'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : device.status === 'offline'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                    }`}>
                      {device.status}
                    </span>
                  </td>
                  {userRole !== 'viewer' && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="relative inline-block text-left">
                        <button
                          ref={(el) => { buttonRefs.current[device.id] = el }}
                          onClick={() => handleDropdownToggle(device.id)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
                        >
                          <MoreVertical className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                        </button>
                        {openDropdownId === device.id && (
                          <div
                            ref={(el) => { dropdownRefs.current[device.id] = el }}
                            className={`fixed right-4 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-[100] ${
                              dropdownPosition.top ? 'mb-2' : 'mt-2'
                            }`}
                            style={{
                              top: getDropdownPosition(device.id)
                            }}
                          >
                            <div className="py-1">
                              <button
                                onClick={() => {
                                  setOpenDropdownId(null)
                                  setSelectedDevice(device)
                                  setShowDetailModal(true)
                                  fetchLastTestResults(device.id)
                          fetchHistoricalTestResults(device.id)
                                }}
                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                Detail
                              </button>
                              <button
                                onClick={() => {
                                  setOpenDropdownId(null)
                                  setSelectedDevice(device)
                                  // Find manufacturer_id from manufacturer name
                                  const manufacturerObj = manufacturers.find(m => m.name === device.manufacturer)
                                  const manufacturer_id = manufacturerObj ? manufacturerObj.id : null
                                  // Find ont_model_id from model name
                                  const ontModelObj = ontModels.find(o => o.name === device.model)
                                  const ont_model_id = ontModelObj ? ontModelObj.id : null
                                  setEditFormData({
                                    device_name: device.device_name,
                                    serial_number: device.serial_number,
                                    mac_address: device.mac_address || '',
                                    ip_address: device.ip_address || '',
                                    group_id: device.group_id,
                                    speed_id: device.speed_id,
                                    indihome_id: device.indihome_id || '',
                                    cpe_type: device.cpe_type || '',
                                    manufacturer_id: manufacturer_id,
                                    ont_model_id: ont_model_id,
                                    status: device.status,
                                    lat: device.lat !== null ? String(device.lat) : '',
                                    lng: device.lng !== null ? String(device.lng) : '',
                                    downstream_server_id: device.downstream_server_id,
                                    area_id: (device as any).area_id ?? null,
                                    cluster_nop_id: (device as any).cluster_nop_id ?? null
                                  })
                                  if ((device as any).area_id && device.downstream_server_id) {
                                    fetchNopClusters((device as any).area_id, device.downstream_server_id)
                                  }
                                  setShowEditModal(true)
                                }}
                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  setOpenDropdownId(null)
                                  handleOnDemandTest(device)
                                }}
                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                <Zap className="w-4 h-4 mr-2" />
                                On Demand Test
                              </button>
                              <button
                                onClick={() => {
                                  setOpenDropdownId(null)
                                  setDeviceToDelete(device)
                                  setShowDeleteDialog(true)
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
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {filteredDevices.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredDevices.length)} of {filteredDevices.length} devices
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1 border rounded ${
                    currentPage === page
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showDetailModal && selectedDevice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 px-8 py-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-white">{selectedDevice.device_name}</h2>
                  <span className={`mt-2 inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                    selectedDevice.status === 'online'
                      ? 'bg-green-500/20 text-green-100 border border-green-400/30'
                      : selectedDevice.status === 'offline'
                      ? 'bg-red-500/20 text-red-100 border border-red-400/30'
                      : 'bg-gray-500/20 text-gray-100 border border-gray-400/30'
                  }`}>
                    {selectedDevice.status}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setShowDetailModal(false)
                    setSelectedDevice(null)
                  }}
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

              {/* Device Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Indihome ID</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedDevice.indihome_id || '-'}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Device S/N</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedDevice.serial_number || '-'}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">IP / MAC Address</p>
                  <div className="flex flex-col">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedDevice.ip_address || '-'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{selectedDevice.mac_address || '-'}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Model</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedDevice.model || '-'}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Manufacturer</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedDevice.manufacturer || '-'}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">CPE Type</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedDevice.cpe_type || '-'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Regional</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedDevice.group_name || '-'}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Speed</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedDevice.speed_name || '-'}</p>
                </div>
              </div>

              {/* Futuristic Architecture Diagram */}
              <OntArchitectureDiagram
                manufacturer={selectedDevice.manufacturer}
                model={selectedDevice.model}
                ipAddress={selectedDevice.ip_address}
                serialNumber={selectedDevice.serial_number}
                status={selectedDevice.status}
                pingIgw={historicalTestResults.ping.length > 0 ? Number(historicalTestResults.ping[historicalTestResults.ping.length - 1].ping_igw) : (selectedDevice.avg_ping ? Number(selectedDevice.avg_ping) : null)}
                pingEbr={historicalTestResults.ping.length > 0 ? Number(historicalTestResults.ping[historicalTestResults.ping.length - 1].ping_ebr) : null}
              />

              {/* Historical Charts */}
              {!loadingHistoricalResults && (historicalTestResults.ping.length > 0 || historicalTestResults.upload.length > 0 || historicalTestResults.download.length > 0) && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Performance History (24 Hours)</h3>
                  
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
                        <Line type="monotone" dataKey="igw" stroke="#3b82f6" strokeWidth={2} name="near IGW" dot={{ r: 3 }} connectNulls={true} />
                        <Line type="monotone" dataKey="ebr" stroke="#8b5cf6" strokeWidth={2} name="near EBR" dot={{ r: 3 }} connectNulls={true} />
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
                              {Math.min(...historicalTestResults.ping.filter(r => r.ping_igw !== null).map(r => Number(r.ping_igw))).toFixed(2)} ms
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">MAX</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                              {Math.max(...historicalTestResults.ping.filter(r => r.ping_igw !== null).map(r => Number(r.ping_igw))).toFixed(2)} ms
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">AVG</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                              {(historicalTestResults.ping.filter(r => r.ping_igw !== null).reduce((sum, r) => sum + Number(r.ping_igw), 0) / historicalTestResults.ping.filter(r => r.ping_igw !== null).length).toFixed(2)} ms
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
                              {Math.min(...historicalTestResults.ping.filter(r => r.ping_ebr !== null).map(r => Number(r.ping_ebr))).toFixed(2)} ms
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">MAX</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                              {Math.max(...historicalTestResults.ping.filter(r => r.ping_ebr !== null).map(r => Number(r.ping_ebr))).toFixed(2)} ms
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">AVG</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                              {(historicalTestResults.ping.filter(r => r.ping_ebr !== null).reduce((sum, r) => sum + Number(r.ping_ebr), 0) / historicalTestResults.ping.filter(r => r.ping_ebr !== null).length).toFixed(2)} ms
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  )}

                  {/* Speed Chart */}
                  {(historicalTestResults.upload.length > 0 || historicalTestResults.download.length > 0) && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
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
                        <Line type="monotone" dataKey="download" stroke="#10b981" strokeWidth={2} name="Download" dot={{ r: 3 }} connectNulls={true} />
                        <Line type="monotone" dataKey="upload" stroke="#f59e0b" strokeWidth={2} name="Upload" dot={{ r: 3 }} connectNulls={true} />
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
                              {historicalTestResults.download.length > 0 ? Math.min(...historicalTestResults.download.filter(r => r.download_speed !== null).map(r => Number(r.download_speed))).toFixed(2) : '-'} Mbps
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">MAX</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                              {historicalTestResults.download.length > 0 ? Math.max(...historicalTestResults.download.filter(r => r.download_speed !== null).map(r => Number(r.download_speed))).toFixed(2) : '-'} Mbps
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">AVG</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                              {historicalTestResults.download.length > 0 ? (historicalTestResults.download.filter(r => r.download_speed !== null).reduce((sum, r) => sum + Number(r.download_speed), 0) / historicalTestResults.download.filter(r => r.download_speed !== null).length).toFixed(2) : '-'} Mbps
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
                              {historicalTestResults.upload.length > 0 ? Math.min(...historicalTestResults.upload.filter(r => r.upload_speed !== null).map(r => Number(r.upload_speed))).toFixed(2) : '-'} Mbps
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">MAX</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                              {historicalTestResults.upload.length > 0 ? Math.max(...historicalTestResults.upload.filter(r => r.upload_speed !== null).map(r => Number(r.upload_speed))).toFixed(2) : '-'} Mbps
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">AVG</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                              {historicalTestResults.upload.length > 0 ? (historicalTestResults.upload.filter(r => r.upload_speed !== null).reduce((sum, r) => sum + Number(r.upload_speed), 0) / historicalTestResults.upload.filter(r => r.upload_speed !== null).length).toFixed(2) : '-'} Mbps
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  )}
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => {
                    setShowDetailModal(false)
                    setSelectedDevice(null)
                  }}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-medium transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedDevice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Device</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    setSelectedDevice(null)
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleUpdate(); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Device Name</label>
                    <input
                      type="text"
                      value={editFormData.device_name}
                      onChange={(e) => setEditFormData({ ...editFormData, device_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Serial Number</label>
                    <input
                      type="text"
                      value={editFormData.serial_number}
                      onChange={(e) => setEditFormData({ ...editFormData, serial_number: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">IP Address</label>
                    <input
                      type="text"
                      value={editFormData.ip_address}
                      onChange={(e) => setEditFormData({ ...editFormData, ip_address: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">MAC Address</label>
                    <input
                      type="text"
                      value={editFormData.mac_address}
                      onChange={(e) => setEditFormData({ ...editFormData, mac_address: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Manufacturer</label>
                    <select
                      value={editFormData.manufacturer_id === null ? '' : editFormData.manufacturer_id}
                      onChange={(e) => setEditFormData({ ...editFormData, manufacturer_id: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Select Manufacturer</option>
                      {manufacturers.map((manufacturer) => (
                        <option key={manufacturer.id} value={manufacturer.id}>
                          {manufacturer.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ONT Model</label>
                    <select
                      value={editFormData.ont_model_id === null ? '' : editFormData.ont_model_id}
                      onChange={(e) => setEditFormData({ ...editFormData, ont_model_id: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Select ONT Model</option>
                      {ontModels.map((ontModel) => (
                        <option key={ontModel.id} value={ontModel.id}>
                          {ontModel.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CPE Type</label>
                    <input
                      type="text"
                      value={editFormData.cpe_type}
                      onChange={(e) => setEditFormData({ ...editFormData, cpe_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Indihome ID</label>
                    <input
                      type="text"
                      value={editFormData.indihome_id}
                      onChange={(e) => setEditFormData({ ...editFormData, indihome_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Speed</label>
                    <select
                      value={editFormData.speed_id === null ? '' : editFormData.speed_id}
                      onChange={(e) => setEditFormData({ ...editFormData, speed_id: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">No Speed Group</option>
                      {speedGroups.map((speedGroup) => (
                        <option key={speedGroup.id} value={speedGroup.id}>
                          {speedGroup.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Area</label>
                    <select
                      value={editFormData.area_id === null ? '' : editFormData.area_id}
                      onChange={(e) => {
                        const areaId = e.target.value ? parseInt(e.target.value) : null
                        setEditFormData({ ...editFormData, area_id: areaId, downstream_server_id: null, cluster_nop_id: null })
                        setNopClusters([])
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">No Area</option>
                      {areas.map((area) => (
                        <option key={area.id} value={area.id}>
                          {area.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Regional</label>
                    <select
                      value={editFormData.downstream_server_id === null ? '' : editFormData.downstream_server_id}
                      onChange={(e) => {
                        const regionalId = e.target.value ? parseInt(e.target.value) : null
                        setEditFormData({ ...editFormData, downstream_server_id: regionalId, cluster_nop_id: null })
                        if (editFormData.area_id && regionalId) {
                          fetchNopClusters(editFormData.area_id, regionalId)
                        } else {
                          setNopClusters([])
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">No Regional</option>
                      {downstreamServers.map((ds) => (
                          <option key={ds.id} value={ds.id}>
                            {ds.name} ({ds.province})
                          </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">NOP City</label>
                    <select
                      value={editFormData.cluster_nop_id === null ? '' : editFormData.cluster_nop_id}
                      onChange={(e) => setEditFormData({ ...editFormData, cluster_nop_id: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">No NOP City</option>
                      {nopClusters.map((nc) => (
                        <option key={nc.id} value={nc.id}>
                          {nc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  >
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      value={editFormData.lat}
                      onChange={(e) => setEditFormData({ ...editFormData, lat: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="-6.2088"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      value={editFormData.lng}
                      onChange={(e) => setEditFormData({ ...editFormData, lng: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="106.8456"
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false)
                      setSelectedDevice(null)
                    }}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Add Device</h2>
                <button
                  onClick={() => {
                    setShowAddModal(false)
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleAdd(); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Device Name</label>
                    <input
                      type="text"
                      value={addFormData.device_name}
                      onChange={(e) => setAddFormData({ ...addFormData, device_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Serial Number</label>
                    <input
                      type="text"
                      value={addFormData.serial_number}
                      onChange={(e) => setAddFormData({ ...addFormData, serial_number: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">IP Address</label>
                    <input
                      type="text"
                      value={addFormData.ip_address}
                      onChange={(e) => setAddFormData({ ...addFormData, ip_address: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">MAC Address</label>
                    <input
                      type="text"
                      value={addFormData.mac_address}
                      onChange={(e) => setAddFormData({ ...addFormData, mac_address: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Manufacturer</label>
                    <select
                      value={addFormData.manufacturer_id === null ? '' : addFormData.manufacturer_id}
                      onChange={(e) => setAddFormData({ ...addFormData, manufacturer_id: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Select Manufacturer</option>
                      {manufacturers.map((manufacturer) => (
                        <option key={manufacturer.id} value={manufacturer.id}>
                          {manufacturer.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ONT Model</label>
                    <select
                      value={addFormData.ont_model_id === null ? '' : addFormData.ont_model_id}
                      onChange={(e) => setAddFormData({ ...addFormData, ont_model_id: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Select ONT Model</option>
                      {ontModels.map((ontModel) => (
                        <option key={ontModel.id} value={ontModel.id}>
                          {ontModel.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CPE Type</label>
                    <input
                      type="text"
                      value={addFormData.cpe_type}
                      onChange={(e) => setAddFormData({ ...addFormData, cpe_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Indihome ID</label>
                    <input
                      type="text"
                      value={addFormData.indihome_id}
                      onChange={(e) => setAddFormData({ ...addFormData, indihome_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Speed</label>
                    <select
                      value={addFormData.speed_id === null ? '' : addFormData.speed_id}
                      onChange={(e) => setAddFormData({ ...addFormData, speed_id: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">No Speed Group</option>
                      {speedGroups.map((speedGroup) => (
                        <option key={speedGroup.id} value={speedGroup.id}>
                          {speedGroup.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Area</label>
                    <select
                      value={addFormData.area_id === null ? '' : addFormData.area_id}
                      onChange={(e) => {
                        const areaId = e.target.value ? parseInt(e.target.value) : null
                        setAddFormData({ ...addFormData, area_id: areaId, downstream_server_id: null, cluster_nop_id: null })
                        setNopClusters([])
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">No Area</option>
                      {areas.map((area) => (
                        <option key={area.id} value={area.id}>
                          {area.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Regional</label>
                    <select
                      value={addFormData.downstream_server_id === null ? '' : addFormData.downstream_server_id}
                      onChange={(e) => {
                        const regionalId = e.target.value ? parseInt(e.target.value) : null
                        setAddFormData({ ...addFormData, downstream_server_id: regionalId, cluster_nop_id: null })
                        if (addFormData.area_id && regionalId) {
                          fetchNopClusters(addFormData.area_id, regionalId)
                        } else {
                          setNopClusters([])
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">No Regional</option>
                      {downstreamServers.map((ds) => (
                          <option key={ds.id} value={ds.id}>
                            {ds.name} ({ds.province})
                          </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">NOP City</label>
                    <select
                      value={addFormData.cluster_nop_id === null ? '' : addFormData.cluster_nop_id}
                      onChange={(e) => setAddFormData({ ...addFormData, cluster_nop_id: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">No NOP City</option>
                      {nopClusters.map((nc) => (
                        <option key={nc.id} value={nc.id}>
                          {nc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                  <select
                    value={addFormData.status}
                    onChange={(e) => setAddFormData({ ...addFormData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  >
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      value={addFormData.lat}
                      onChange={(e) => setAddFormData({ ...addFormData, lat: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="-6.2088"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      value={addFormData.lng}
                      onChange={(e) => setAddFormData({ ...addFormData, lng: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="106.8456"
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false)
                    }}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                  >
                    Add Device
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showDeleteDialog && deviceToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Delete Device</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Are you sure you want to delete <strong>{deviceToDelete.device_name}</strong>? This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteDialog(false)
                    setDeviceToDelete(null)
                  }}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showOnDemandTestModal && onDemandTestDevice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">On Demand Test</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Select test types for <strong>{onDemandTestDevice.device_name}</strong>
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Device S/N
                </label>
                <p className="text-gray-900 dark:text-white">{onDemandTestDevice.serial_number}</p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Test Type
                </label>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="ping"
                      checked={selectedTestTypes.ping}
                      onChange={() => handleTestTypeChange('ping')}
                      className="mr-2 w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                    />
                    <label htmlFor="ping" className="text-sm text-gray-700 dark:text-gray-300">
                      Ping
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="traceroute"
                      checked={selectedTestTypes.traceroute}
                      onChange={() => handleTestTypeChange('traceroute')}
                      className="mr-2 w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                    />
                    <label htmlFor="traceroute" className="text-sm text-gray-700 dark:text-gray-300">
                      Traceroute
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="upload"
                      checked={selectedTestTypes.upload}
                      onChange={() => handleTestTypeChange('upload')}
                      className="mr-2 w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                    />
                    <label htmlFor="upload" className="text-sm text-gray-700 dark:text-gray-300">
                      Upload
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="download"
                      checked={selectedTestTypes.download}
                      onChange={() => handleTestTypeChange('download')}
                      className="mr-2 w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                    />
                    <label htmlFor="download" className="text-sm text-gray-700 dark:text-gray-300">
                      Download
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowOnDemandTestModal(false)
                    setOnDemandTestDevice(null)
                  }}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmStart}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Start
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showConfirmDialog && onDemandTestDevice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Confirm On Demand Test</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Are you sure you want to start the test for <strong>{onDemandTestDevice.device_name}</strong>?
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Selected Tests:
                </label>
                <p className="text-gray-900 dark:text-white">
                  {Object.entries(selectedTestTypes)
                    .filter(([_, checked]) => checked)
                    .map(([type, _]) => type.charAt(0).toUpperCase() + type.slice(1))
                    .join(', ')}
                </p>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartOnDemandTest}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DevicesPageWrapper() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DevicesPageContent />
    </Suspense>
  )
}
