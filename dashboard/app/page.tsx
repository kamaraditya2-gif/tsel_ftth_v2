'use client'

import { useEffect, useState } from 'react'
import { Activity, Server, Database, Network, Clock, ChevronDown, MapPin, Gauge as GaugeIcon, Download, CheckCircle, XCircle, AlertCircle, Building2, Box, Globe, Bell, AlertTriangle, BarChart3, Thermometer, ZapOff, Wifi, Cpu, HardDrive, TrendingUp } from 'lucide-react'
import PingChart from '@/components/PingChart'
import SkeletonCard from '@/components/SkeletonCard'
import ThresholdChart from '@/components/ThresholdChart'
import TopDevicesCard from '@/components/TopDevicesCard'
import KPIBigCard from '@/components/KPIBigCard'
import AlarmPieChart from '@/components/AlarmPieChart'
import L1AvailabilityCard from '@/components/L1AvailabilityCard'
import TopAlarmCard from '@/components/TopAlarmCard'
import PerformanceAnalytics from '@/components/PerformanceAnalytics'
import TopCards from '@/components/TopCards'
import NetworkDiagram from '@/components/NetworkDiagram'
import LocationFilter from '@/components/LocationFilter'
import dynamic from 'next/dynamic'

const DeviceHeatmap = dynamic(() => import('@/components/DeviceHeatmap'), { ssr: false })
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

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

interface OntTypeComparison {
  name: string
  total_devices: number
  online_devices: number
  avg_download: number
  avg_upload: number
  avg_igw_latency: number
  avg_ebr_latency: number
  avg_packet_loss_igw: number
  avg_packet_loss_ebr: number
  download_tests: number
  upload_tests: number
  ping_tests: number
  packet_loss_tests: number
}

export default function DashboardPage() {
  const [systemStatus, setSystemStatus] = useState<any>(null)
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('24h')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [speedGroupDropdownOpen, setSpeedGroupDropdownOpen] = useState(false)
  const [manufacturerDropdownOpen, setManufacturerDropdownOpen] = useState(false)
  const [ontModelDropdownOpen, setOntModelDropdownOpen] = useState(false)
  const [selectedRegional, setSelectedRegional] = useState<number | null>(null)
  const [selectedNopCity, setSelectedNopCity] = useState<number | null>(null)
  const [selectedSpeedGroup, setSelectedSpeedGroup] = useState<number | null>(null)
  const [selectedManufacturer, setSelectedManufacturer] = useState<number | null>(null)
  const [selectedOntModel, setSelectedOntModel] = useState<number | null>(null)
  const [speedGroups, setSpeedGroups] = useState<SpeedGroup[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [ontModels, setOntModels] = useState<OntModel[]>([])
  const [selectedArea, setSelectedArea] = useState<number | null>(null)
  const [ontTypeData, setOntTypeData] = useState<OntTypeComparison[]>([])
  const [ontBrandData, setOntBrandData] = useState<OntTypeComparison[]>([])
  const [dashboardV2, setDashboardV2] = useState<any>(null)
  const [alarmStats, setAlarmStats] = useState<any>(null)
  const [showPhase3, setShowPhase3] = useState(false)
  const [filterLocStr, setFilterLocStr] = useState({ areaIds: '', regionalIds: '', nopIds: '' })

  useEffect(() => {
    fetchSystemStatus()
    fetchDashboardData()
    fetchSpeedGroups()
    fetchManufacturers()
    fetchOntModels()
    fetchOntTypeComparison()
    fetchOntBrandComparison()
    fetchDashboardV2()
    fetchAlarmStats()

    // Refresh data every 30 seconds
    const interval = setInterval(() => {
      fetchSystemStatus()
      fetchDashboardData()
      fetchOntTypeComparison()
      fetchOntBrandComparison()
      fetchDashboardV2()
      fetchAlarmStats()
    }, 30000)

    return () => clearInterval(interval)
  }, [timeRange, selectedArea, selectedRegional, selectedNopCity, selectedSpeedGroup, selectedManufacturer, selectedOntModel, filterLocStr])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      
      // Close time range dropdown if click is outside
      if (isDropdownOpen) {
        const dropdown = document.getElementById('time-range-dropdown')
        if (dropdown && !dropdown.contains(target)) {
          setIsDropdownOpen(false)
        }
      }
      
      // Close speed group dropdown if click is outside
      if (speedGroupDropdownOpen) {
        const dropdown = document.getElementById('speed-group-dropdown')
        if (dropdown && !dropdown.contains(target)) {
          setSpeedGroupDropdownOpen(false)
        }
      }
      
      // Close manufacturer dropdown if click is outside
      if (manufacturerDropdownOpen) {
        const dropdown = document.getElementById('manufacturer-dropdown')
        if (dropdown && !dropdown.contains(target)) {
          setManufacturerDropdownOpen(false)
        }
      }
      
      // Close ont model dropdown if click is outside
      if (ontModelDropdownOpen) {
        const dropdown = document.getElementById('ont-model-dropdown')
        if (dropdown && !dropdown.contains(target)) {
          setOntModelDropdownOpen(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isDropdownOpen, speedGroupDropdownOpen, manufacturerDropdownOpen, ontModelDropdownOpen])

  const fetchSystemStatus = async () => {
    try {
      const res = await fetch('/api/system/status')
      const data = await res.json()
      setSystemStatus(data)
    } catch (error) {
      console.error('Failed to fetch system status:', error)
    }
  }

  const fetchDashboardData = async () => {
    try {
      const params = new URLSearchParams({ timeRange })
      if (filterLocStr.areaIds) params.append('areaIds', filterLocStr.areaIds)
      else if (selectedArea) params.append('areaId', selectedArea.toString())
      if (filterLocStr.regionalIds) params.append('regionalIds', filterLocStr.regionalIds)
      else if (selectedRegional) params.append('regionalId', selectedRegional.toString())
      if (filterLocStr.nopIds) params.append('nopIds', filterLocStr.nopIds)
      else if (selectedNopCity) params.append('nopId', selectedNopCity.toString())
      if (selectedSpeedGroup) {
        params.append('speedGroupId', selectedSpeedGroup.toString())
      }
      if (selectedManufacturer) {
        params.append('manufacturerId', selectedManufacturer.toString())
      }
      if (selectedOntModel) {
        params.append('ontModelId', selectedOntModel.toString())
      }
      const res = await fetch(`/api/dashboard/summary?${params.toString()}`)
      const data = await res.json()
      setDashboardData(data)
      setIsLoading(false)
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
      setIsLoading(false)
    }
  }

  const fetchOntTypeComparison = async () => {
    try {
      const p = new URLSearchParams({ timeRange })
      if (filterLocStr.areaIds) p.append('areaIds', filterLocStr.areaIds)
      else if (selectedArea) p.append('areaId', selectedArea.toString())
      if (filterLocStr.regionalIds) p.append('regionalIds', filterLocStr.regionalIds)
      else if (selectedRegional) p.append('regionalId', selectedRegional.toString())
      if (filterLocStr.nopIds) p.append('nopIds', filterLocStr.nopIds)
      else if (selectedNopCity) p.append('nopId', selectedNopCity.toString())
      const res = await fetch(`/api/dashboard/ont-type-comparison?${p}`)
      const data = await res.json()
      if (data.data && Array.isArray(data.data)) {
        setOntTypeData(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch ONT type comparison:', error)
    }
  }

  const fetchOntBrandComparison = async () => {
    try {
      const p = new URLSearchParams({ timeRange })
      if (filterLocStr.areaIds) p.append('areaIds', filterLocStr.areaIds)
      else if (selectedArea) p.append('areaId', selectedArea.toString())
      if (filterLocStr.regionalIds) p.append('regionalIds', filterLocStr.regionalIds)
      else if (selectedRegional) p.append('regionalId', selectedRegional.toString())
      if (filterLocStr.nopIds) p.append('nopIds', filterLocStr.nopIds)
      else if (selectedNopCity) p.append('nopId', selectedNopCity.toString())
      const res = await fetch(`/api/dashboard/ont-brand-comparison?${p}`)
      const data = await res.json()
      if (data.data && Array.isArray(data.data)) {
        setOntBrandData(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch ONT brand comparison:', error)
    }
  }

  const fetchDashboardV2 = async () => {
    try {
      const res = await fetch('/api/dashboard/v2')
      const data = await res.json()
      if (data && data.kpi && data.threshold && data.rootCause && data.topAlarms) setDashboardV2(data)
    } catch (error) {
      console.error('Failed to fetch dashboard v2 data:', error)
    }
  }

  const fetchAlarmStats = async () => {
    try {
      const p = new URLSearchParams()
      if (filterLocStr.areaIds) p.set('area_ids', filterLocStr.areaIds)
      else if (selectedArea) p.set('area_id', selectedArea.toString())
      if (filterLocStr.regionalIds) p.set('regional_ids', filterLocStr.regionalIds)
      else if (selectedRegional) p.set('regional_id', selectedRegional.toString())
      if (filterLocStr.nopIds) p.set('nop_ids', filterLocStr.nopIds)
      else if (selectedNopCity) p.set('nop_id', selectedNopCity.toString())
      const res = await fetch(`/api/alarms/check?${p.toString()}`)
      const data = await res.json()
      const alarms = data.alarms || []
      const cleared = data.cleared || []
      const build = (list: any[]) => {
        let total = 0; const byType: Record<string, number> = {}; const bySeverity: Record<string, number> = {}
        list.forEach((d: any) => {
          d.alarms?.forEach((a: any) => {
            total++; byType[a.alarm_type] = (byType[a.alarm_type] || 0) + 1
            bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1
          })
        })
        return { total, byType, bySeverity }
      }
      setAlarmStats({ active: build(alarms), cleared: build(cleared) })
    } catch (error) {
      console.error('Failed to fetch alarm stats:', error)
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

  const getTimeRangeLabel = () => {
    switch (timeRange) {
      case '1h': return 'Last 1 Hour'
      case '6h': return 'Last 6 Hours'
      case '24h': return 'Last 24 Hours'
      case '7d': return 'Last 7 Days'
      case '30d': return 'Last 30 Days'
      default: return 'Last 24 Hours'
    }
  }

  const getSpeedGroupLabel = () => {
    if (!selectedSpeedGroup) return 'All Speeds'
    const speedGroup = speedGroups.find(s => s.id === selectedSpeedGroup)
    return speedGroup?.name || 'All Speeds'
  }

  const getManufacturerLabel = () => {
    if (!selectedManufacturer) return 'All Manufacturers'
    const manufacturer = manufacturers.find(m => m.id === selectedManufacturer)
    return manufacturer?.name || 'All Manufacturers'
  }

  const getOntModelLabel = () => {
    if (!selectedOntModel) return 'All ONT Models'
    const ontModel = ontModels.find(o => o.id === selectedOntModel)
    return ontModel?.name || 'All ONT Models'
  }

  const downloadReport = (type: string) => {
    let data: any[] = []
    let filename = ''

    switch (type) {
      case 'device-status':
        data = [
          { metric: 'Total Devices', value: dashboardData.totalDevices },
          { metric: 'Online', value: dashboardData.deviceStatus?.online },
          { metric: 'Offline', value: dashboardData.deviceStatus?.offline }
        ]
        filename = 'device-status-report.csv'
        break
      case 'latency':
        data = dashboardData.pingData?.map((item: any) => ({
          time: item.hour,
          igw_avg: item.igw,
          igw_min: item.igw_min,
          igw_max: item.igw_max,
          ebr_avg: item.ebr,
          ebr_min: item.ebr_min,
          ebr_max: item.ebr_max
        })) || []
        filename = 'latency-report.csv'
        break
      case 'speed':
        data = dashboardData.speedData?.map((item: any) => ({
          time: item.hour,
          download_avg: item.avg_download,
          download_min: item.min_download,
          download_max: item.max_download,
          upload_avg: item.avg_upload,
          upload_min: item.min_upload,
          upload_max: item.max_upload
        })) || []
        filename = 'speed-report.csv'
        break
      case 'worst-devices':
        data = dashboardData.topDevices?.slowestLatency?.map((item: any) => ({
          device_name: item.deviceName,
          serial_number: item.serialNumber,
          regional: item.regionalName,
          speed: item.speedName,
          avg_latency: item.value
        })) || []
        filename = 'worst-devices-report.csv'
        break
      case 'worst-devices-igw':
        data = dashboardData.topDevices?.slowestLatencyIgw?.map((item: any) => ({
          device_name: item.deviceName,
          serial_number: item.serialNumber,
          regional: item.regionalName,
          speed: item.speedName,
          max_igw_latency: item.value
        })) || []
        filename = 'worst-igw-latency-devices-report.csv'
        break
      case 'worst-devices-ebr':
        data = dashboardData.topDevices?.slowestLatencyEbr?.map((item: any) => ({
          device_name: item.deviceName,
          serial_number: item.serialNumber,
          regional: item.regionalName,
          speed: item.speedName,
          max_ebr_latency: item.value
        })) || []
        filename = 'worst-ebr-latency-devices-report.csv'
        break
      case 'packet-loss-devices':
        data = dashboardData.topDevices?.highestPacketLoss?.map((item: any) => ({
          device_name: item.deviceName,
          serial_number: item.serialNumber,
          regional: item.regionalName,
          speed: item.speedName,
          avg_packet_loss: item.value
        })) || []
        filename = 'packet-loss-devices-report.csv'
        break
      case 'below-download-threshold':
        data = dashboardData.topDevices?.belowDownloadThreshold?.map((item: any) => ({
          device_name: item.deviceName,
          serial_number: item.serialNumber,
          regional: item.regionalName,
          speed: item.speedName,
          avg_download: item.value,
          threshold: item.threshold
        })) || []
        filename = 'below-download-threshold-report.csv'
        break
      case 'below-upload-threshold':
        data = dashboardData.topDevices?.belowUploadThreshold?.map((item: any) => ({
          device_name: item.deviceName,
          serial_number: item.serialNumber,
          regional: item.regionalName,
          speed: item.speedName,
          avg_upload: item.value,
          threshold: item.threshold
        })) || []
        filename = 'below-upload-threshold-report.csv'
        break
      default:
        return
    }

    if (data.length === 0) return

    // Convert to CSV
    const headers = Object.keys(data[0])
    const csvContent = [
      headers.join(','),
      ...data.map((row: any) => headers.map((header: string) => row[header]).join(','))
    ].join('\n')

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen p-8 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <h1 className="text-3xl font-bold mb-8 text-white tracking-wide">Network Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10">
      <div className="flex flex-col xl:flex-row xl:justify-between xl:items-center mb-8 gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Time Range Dropdown */}
          <div className="relative" id="time-range-dropdown">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-purple-500/30 bg-white/10 backdrop-blur-md text-sm text-white hover:bg-white/20 transition-all duration-300 whitespace-nowrap shadow-lg shadow-purple-500/20"
            >
              <Clock className="w-4 h-4 text-purple-300" />
              <span className="truncate max-w-[120px]">{getTimeRangeLabel()}</span>
              <ChevronDown className="w-4 h-4 text-purple-300 flex-shrink-0" />
            </button>
            
            {isDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 bg-slate-900/95 backdrop-blur-md border border-purple-500/30 rounded-lg shadow-xl shadow-purple-500/20 z-10 min-w-[150px]">
                <button
                  onClick={() => {
                    setTimeRange('1h')
                    setIsDropdownOpen(false)
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-white hover:bg-purple-500/20 transition-colors first:rounded-t-lg"
                >
                  Last 1 Hour
                </button>
                <button
                  onClick={() => {
                    setTimeRange('6h')
                    setIsDropdownOpen(false)
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-white hover:bg-purple-500/20 transition-colors"
                >
                  Last 6 Hours
                </button>
                <button
                  onClick={() => {
                    setTimeRange('24h')
                    setIsDropdownOpen(false)
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-white hover:bg-purple-500/20 transition-colors"
                >
                  Last 24 Hours
                </button>
                <button
                  onClick={() => {
                    setTimeRange('7d')
                    setIsDropdownOpen(false)
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-white hover:bg-purple-500/20 transition-colors"
                >
                  Last 7 Days
                </button>
                <button
                  onClick={() => {
                    setTimeRange('30d')
                    setIsDropdownOpen(false)
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-white hover:bg-purple-500/20 transition-colors last:rounded-b-lg"
                >
                  Last 30 Days
                </button>
              </div>
            )}
          </div>

          {/* Location Cascading */}
          <LocationFilter onFilterChange={(f) => {
            setSelectedArea(f.areaIds[0] ?? null);
            setSelectedRegional(f.regionalIds[0] ?? null);
            setSelectedNopCity(f.nopIds[0] ?? null);
            setFilterLocStr({ areaIds: f.areaIds.join(','), regionalIds: f.regionalIds.join(','), nopIds: f.nopIds.join(',') })
          }} />

          {/* Speed Group Dropdown */}
          <div className="relative" id="speed-group-dropdown">
            <button
              onClick={() => setSpeedGroupDropdownOpen(!speedGroupDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-purple-500/30 bg-white/10 backdrop-blur-md text-sm text-white hover:bg-white/20 transition-all duration-300 whitespace-nowrap shadow-lg shadow-purple-500/20"
            >
              <GaugeIcon className="w-4 h-4 text-purple-300" />
              <span className="truncate max-w-[120px]">{getSpeedGroupLabel()}</span>
              <ChevronDown className="w-4 h-4 text-purple-300 flex-shrink-0" />
            </button>

            {speedGroupDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 bg-slate-900/95 backdrop-blur-md border border-purple-500/30 rounded-lg shadow-xl shadow-purple-500/20 z-10 min-w-[150px] max-h-[300px] overflow-y-auto">
                <button
                  onClick={() => {
                    setSelectedSpeedGroup(null)
                    setSpeedGroupDropdownOpen(false)
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-white hover:bg-purple-500/20 transition-colors first:rounded-t-lg"
                >
                  All Speeds
                </button>
                {speedGroups.map((speedGroup) => (
                  <button
                    key={speedGroup.id}
                    onClick={() => {
                      setSelectedSpeedGroup(speedGroup.id)
                      setSpeedGroupDropdownOpen(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-white hover:bg-purple-500/20 transition-colors"
                  >
                    {speedGroup.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Manufacturer Dropdown */}
          <div className="relative" id="manufacturer-dropdown">
            <button
              onClick={() => setManufacturerDropdownOpen(!manufacturerDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-purple-500/30 bg-white/10 backdrop-blur-md text-sm text-white hover:bg-white/20 transition-all duration-300 whitespace-nowrap shadow-lg shadow-purple-500/20"
            >
              <Building2 className="w-4 h-4 text-purple-300" />
              <span className="truncate max-w-[120px]">{getManufacturerLabel()}</span>
              <ChevronDown className="w-4 h-4 text-purple-300 flex-shrink-0" />
            </button>

            {manufacturerDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 bg-slate-900/95 backdrop-blur-md border border-purple-500/30 rounded-lg shadow-xl shadow-purple-500/20 z-10 min-w-[150px] max-h-[300px] overflow-y-auto">
                <button
                  onClick={() => {
                    setSelectedManufacturer(null)
                    setManufacturerDropdownOpen(false)
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-white hover:bg-purple-500/20 transition-colors first:rounded-t-lg"
                >
                  All Manufacturers
                </button>
                {manufacturers.map((manufacturer) => (
                  <button
                    key={manufacturer.id}
                    onClick={() => {
                      setSelectedManufacturer(manufacturer.id)
                      setManufacturerDropdownOpen(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-white hover:bg-purple-500/20 transition-colors"
                  >
                    {manufacturer.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ONT Model Dropdown */}
          <div className="relative" id="ont-model-dropdown">
            <button
              onClick={() => setOntModelDropdownOpen(!ontModelDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-purple-500/30 bg-white/10 backdrop-blur-md text-sm text-white hover:bg-white/20 transition-all duration-300 whitespace-nowrap shadow-lg shadow-purple-500/20"
            >
              <Box className="w-4 h-4 text-purple-300" />
              <span className="truncate max-w-[120px]">{getOntModelLabel()}</span>
              <ChevronDown className="w-4 h-4 text-purple-300 flex-shrink-0" />
            </button>

            {ontModelDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 bg-slate-900/95 backdrop-blur-md border border-purple-500/30 rounded-lg shadow-xl shadow-purple-500/20 z-10 min-w-[150px] max-h-[300px] overflow-y-auto">
                <button
                  onClick={() => {
                    setSelectedOntModel(null)
                    setOntModelDropdownOpen(false)
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-white hover:bg-purple-500/20 transition-colors first:rounded-t-lg"
                >
                  All ONT Models
                </button>
                {ontModels.map((ontModel) => (
                  <button
                    key={ontModel.id}
                    onClick={() => {
                      setSelectedOntModel(ontModel.id)
                      setOntModelDropdownOpen(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-white hover:bg-purple-500/20 transition-colors"
                  >
                    {ontModel.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="text-sm text-gray-300">
            Last updated: {new Date().toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
              timeZone: 'Asia/Jakarta'
            })}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {dashboardData && (
        <TopCards
          dashboardData={dashboardData}
          dashboardV2={dashboardV2}
          ontBrandData={ontBrandData}
          ontTypeData={ontTypeData}
          alarmStats={alarmStats}
          filterParams={filterLocStr}
        />
      )}

      {/* Speed Threshold Comparison */}
      {dashboardData && (
        <div className="mb-6">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl shadow-indigo-500/10 border border-indigo-500/20">
                <ThresholdChart
                  timeRange={timeRange}
                  areaIds={filterLocStr.areaIds || undefined}
                  regionalIds={filterLocStr.regionalIds || undefined}
                  nopIds={filterLocStr.nopIds || undefined}
                  areaId={selectedArea ? selectedArea.toString() : undefined}
                  regionalId={selectedRegional ? selectedRegional.toString() : undefined}
                  nopId={selectedNopCity ? selectedNopCity.toString() : undefined}
                  speedGroupId={selectedSpeedGroup ? selectedSpeedGroup.toString() : undefined}
                />
          </div>
        </div>
      )}

      {/* Network Diagram */}
      {dashboardData && dashboardV2 && (
        <div className="mb-4">
          <NetworkDiagram
            upstream={{
              avgDownload: Number(dashboardData.avgDownload) || 0,
              avgUpload: Number(dashboardData.avgUpload) || 0,
              avgLatency: Number(dashboardData.avgPingIgw) || 0,
              avgEbrLatency: Number(dashboardData.avgPingEbr) || 0,
            }}
            downstream={{
              avgLatency: Number(dashboardV2.downstream?.avg_latency) || 0,
              avgPacketLoss: Number(dashboardV2.downstream?.avg_packet_loss) || 0,
            }}
          />
        </div>
      )}

      {/* Device Heatmap */}
      <div className="mb-8">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl shadow-purple-500/10 border border-purple-500/20 p-6 hover:shadow-2xl hover:shadow-purple-500/20 transition-all duration-300">
                  <DeviceHeatmap
                    timeRange={timeRange}
                    areaIds={filterLocStr.areaIds || undefined}
                    regionalIds={filterLocStr.regionalIds || undefined}
                    nopIds={filterLocStr.nopIds || undefined}
                    areaId={selectedArea ? selectedArea.toString() : undefined}
                    regionalId={selectedRegional ? selectedRegional.toString() : undefined}
                    nopId={selectedNopCity ? selectedNopCity.toString() : undefined}
                    speedGroupId={selectedSpeedGroup ? selectedSpeedGroup.toString() : undefined}
                    manufacturerId={selectedManufacturer ? selectedManufacturer.toString() : undefined}
                    ontModelId={selectedOntModel ? selectedOntModel.toString() : undefined}
                  />
        </div>
      </div>

      {/* ONT Type Comparison */}
      {ontTypeData.length > 0 && (
        <div className="mb-8">
          <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-md p-5 shadow-lg shadow-indigo-500/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">ONT Type Comparison</h2>
                  <p className="text-xs text-indigo-300/70">Speed & latency per CPE type — {getTimeRangeLabel()}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Speed by ONT Type */}
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={ontTypeData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="gradONTDL" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9}/>
                        <stop offset="100%" stopColor="#4338ca" stopOpacity={0.4}/>
                      </linearGradient>
                      <linearGradient id="gradONTUL" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.9}/>
                        <stop offset="100%" stopColor="#6d28d9" stopOpacity={0.4}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: 'rgba(148,163,184,0.2)' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: 'rgba(148,163,184,0.2)' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '12px', backdropFilter: 'blur(12px)' }}
                      itemStyle={{ color: '#e2e8f0', fontSize: '12px' }}
                      labelStyle={{ color: '#a5b4fc', fontWeight: 600, marginBottom: '4px' }}
                    />
                    <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="avg_download" name="Avg Download (Mbps)" fill="url(#gradONTDL)" radius={[6,6,0,0]} barSize={20} animationDuration={1200} />
                    <Bar dataKey="avg_upload" name="Avg Upload (Mbps)" fill="url(#gradONTUL)" radius={[6,6,0,0]} barSize={20} animationDuration={1200} />
                  </BarChart>
                </ResponsiveContainer>

                {/* Latency by ONT Type */}
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={ontTypeData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="gradONTIGW" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.9}/>
                        <stop offset="100%" stopColor="#d97706" stopOpacity={0.4}/>
                      </linearGradient>
                      <linearGradient id="gradONTEBR" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity={0.9}/>
                        <stop offset="100%" stopColor="#dc2626" stopOpacity={0.4}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: 'rgba(148,163,184,0.2)' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: 'rgba(148,163,184,0.2)' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px', backdropFilter: 'blur(12px)' }}
                      itemStyle={{ color: '#e2e8f0', fontSize: '12px' }}
                      labelStyle={{ color: '#fcd34d', fontWeight: 600, marginBottom: '4px' }}
                    />
                    <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="avg_igw_latency" name="near IGW Latency (ms)" fill="url(#gradONTIGW)" radius={[6,6,0,0]} barSize={20} animationDuration={1200} />
                    <Bar dataKey="avg_ebr_latency" name="near EBR Latency (ms)" fill="url(#gradONTEBR)" radius={[6,6,0,0]} barSize={20} animationDuration={1200} />
                  </BarChart>
                </ResponsiveContainer>

                {/* Packet Loss by ONT Type */}
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={ontTypeData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="gradONTPLIGW" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.9}/>
                        <stop offset="100%" stopColor="#059669" stopOpacity={0.4}/>
                      </linearGradient>
                      <linearGradient id="gradONTPLEBR" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.9}/>
                        <stop offset="100%" stopColor="#0891b2" stopOpacity={0.4}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: 'rgba(148,163,184,0.2)' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: 'rgba(148,163,184,0.2)' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '12px', backdropFilter: 'blur(12px)' }}
                      itemStyle={{ color: '#e2e8f0', fontSize: '12px' }}
                      labelStyle={{ color: '#6ee7b7', fontWeight: 600, marginBottom: '4px' }}
                    />
                    <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="avg_packet_loss_igw" name="Packet Loss near IGW (%)" fill="url(#gradONTPLIGW)" radius={[6,6,0,0]} barSize={20} animationDuration={1200} />
                    <Bar dataKey="avg_packet_loss_ebr" name="Packet Loss near EBR (%)" fill="url(#gradONTPLEBR)" radius={[6,6,0,0]} barSize={20} animationDuration={1200} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* ONT Type Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-4">
                {ontTypeData.map((ont, idx) => (
                  <div key={idx} className="bg-white/5 rounded-xl p-3 border border-white/10 hover:bg-white/10 transition-colors">
                    <p className="text-xs font-medium text-indigo-300 truncate">{ont.name}</p>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-lg font-bold text-white">{ont.total_devices}</span>
                      <span className="text-[10px] text-gray-400">devices</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[10px]">
                      <span className="text-cyan-400">↓{ont.avg_download || 0}</span>
                      <span className="text-green-400">↑{ont.avg_upload || 0}</span>
                      <span className="text-orange-400">P{ont.avg_igw_latency || 0}ms</span>
                      <span className="text-teal-400">PL{ont.avg_packet_loss_igw || 0}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ONT per Brand Comparison */}
      {ontBrandData.length > 0 && (
        <div className="mb-8">
          <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-md p-5 shadow-lg shadow-emerald-500/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">ONT per Brand Comparison</h2>
                  <p className="text-xs text-emerald-300/70">Speed & latency per manufacturer — {getTimeRangeLabel()}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Speed by Brand */}
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={ontBrandData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="gradBRNDDL" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.9}/>
                        <stop offset="100%" stopColor="#059669" stopOpacity={0.4}/>
                      </linearGradient>
                      <linearGradient id="gradBRNDUL" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.9}/>
                        <stop offset="100%" stopColor="#0d9488" stopOpacity={0.4}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: 'rgba(148,163,184,0.2)' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: 'rgba(148,163,184,0.2)' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '12px', backdropFilter: 'blur(12px)' }}
                      itemStyle={{ color: '#e2e8f0', fontSize: '12px' }}
                      labelStyle={{ color: '#6ee7b7', fontWeight: 600, marginBottom: '4px' }}
                    />
                    <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="avg_download" name="Avg Download (Mbps)" fill="url(#gradBRNDDL)" radius={[6,6,0,0]} barSize={20} animationDuration={1200} />
                    <Bar dataKey="avg_upload" name="Avg Upload (Mbps)" fill="url(#gradBRNDUL)" radius={[6,6,0,0]} barSize={20} animationDuration={1200} />
                  </BarChart>
                </ResponsiveContainer>

                {/* Latency by Brand */}
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={ontBrandData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="gradBRNDIGW" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.9}/>
                        <stop offset="100%" stopColor="#d97706" stopOpacity={0.4}/>
                      </linearGradient>
                      <linearGradient id="gradBRNDEBR" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity={0.9}/>
                        <stop offset="100%" stopColor="#dc2626" stopOpacity={0.4}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: 'rgba(148,163,184,0.2)' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: 'rgba(148,163,184,0.2)' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px', backdropFilter: 'blur(12px)' }}
                      itemStyle={{ color: '#e2e8f0', fontSize: '12px' }}
                      labelStyle={{ color: '#fcd34d', fontWeight: 600, marginBottom: '4px' }}
                    />
                    <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="avg_igw_latency" name="near IGW Latency (ms)" fill="url(#gradBRNDIGW)" radius={[6,6,0,0]} barSize={20} animationDuration={1200} />
                    <Bar dataKey="avg_ebr_latency" name="near EBR Latency (ms)" fill="url(#gradBRNDEBR)" radius={[6,6,0,0]} barSize={20} animationDuration={1200} />
                  </BarChart>
                </ResponsiveContainer>

                {/* Packet Loss by Brand */}
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={ontBrandData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="gradBRNDPLIGW" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.9}/>
                        <stop offset="100%" stopColor="#6d28d9" stopOpacity={0.4}/>
                      </linearGradient>
                      <linearGradient id="gradBRNDPLEBR" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ec4899" stopOpacity={0.9}/>
                        <stop offset="100%" stopColor="#be185d" stopOpacity={0.4}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: 'rgba(148,163,184,0.2)' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: 'rgba(148,163,184,0.2)' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '12px', backdropFilter: 'blur(12px)' }}
                      itemStyle={{ color: '#e2e8f0', fontSize: '12px' }}
                      labelStyle={{ color: '#c4b5fd', fontWeight: 600, marginBottom: '4px' }}
                    />
                    <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="avg_packet_loss_igw" name="Packet Loss near IGW (%)" fill="url(#gradBRNDPLIGW)" radius={[6,6,0,0]} barSize={20} animationDuration={1200} />
                    <Bar dataKey="avg_packet_loss_ebr" name="Packet Loss near EBR (%)" fill="url(#gradBRNDPLEBR)" radius={[6,6,0,0]} barSize={20} animationDuration={1200} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Brand Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-4">
                {ontBrandData.map((brand, idx) => (
                  <div key={idx} className="bg-white/5 rounded-xl p-3 border border-white/10 hover:bg-white/10 transition-colors">
                    <p className="text-xs font-medium text-emerald-300 truncate">{brand.name}</p>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-lg font-bold text-white">{brand.total_devices}</span>
                      <span className="text-[10px] text-gray-400">devices</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[10px]">
                      <span className="text-cyan-400">↓{brand.avg_download || 0}</span>
                      <span className="text-green-400">↑{brand.avg_upload || 0}</span>
                      <span className="text-orange-400">P{brand.avg_igw_latency || 0}ms</span>
                      <span className="text-teal-400">PL{brand.avg_packet_loss_igw || 0}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Latency Chart */}
          {dashboardData?.pingData && (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl shadow-blue-500/10 border border-blue-500/20 p-6 hover:shadow-2xl hover:shadow-blue-500/20 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Latency Trend ({getTimeRangeLabel()})</h2>
                <button
                  onClick={() => downloadReport('latency')}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-300 hover:text-white hover:bg-blue-500/20 rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
              <div className="mb-6">
                <PingChart data={dashboardData.pingData} type="latency" />
              </div>
              {dashboardData.pingStats && (
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-blue-500/20 rounded-lg p-4 border border-blue-500/30">
                    <h3 className="text-sm font-semibold text-blue-300 mb-3">near IGW Latency</h3>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-xs text-gray-400">MIN</p>
                        <p className="text-sm font-semibold text-white">{dashboardData.pingStats.igw.min} ms</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">MAX</p>
                        <p className="text-sm font-semibold text-white">{dashboardData.pingStats.igw.max} ms</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">AVG</p>
                        <p className="text-sm font-semibold text-white">{dashboardData.pingStats.igw.avg} ms</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-purple-500/20 rounded-lg p-4 border border-purple-500/30">
                    <h3 className="text-sm font-semibold text-purple-300 mb-3">near EBR Latency</h3>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-xs text-gray-400">MIN</p>
                        <p className="text-sm font-semibold text-white">{dashboardData.pingStats.ebr.min} ms</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">MAX</p>
                        <p className="text-sm font-semibold text-white">{dashboardData.pingStats.ebr.max} ms</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">AVG</p>
                        <p className="text-sm font-semibold text-white">{dashboardData.pingStats.ebr.avg} ms</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Speed Chart */}
          {dashboardData?.speedData && (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl shadow-green-500/10 border border-green-500/20 p-6 hover:shadow-2xl hover:shadow-green-500/20 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Speed Test Results ({getTimeRangeLabel()})</h2>
                <button
                  onClick={() => downloadReport('speed')}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-green-300 hover:text-white hover:bg-green-500/20 rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
              <div className="mb-6">
                <PingChart data={dashboardData.speedData} type="speed" />
              </div>
              {dashboardData.speedStats && (
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-green-500/20 rounded-lg p-4 border border-green-500/30">
                    <h3 className="text-sm font-semibold text-green-300 mb-3">Download Speed</h3>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-xs text-gray-400">MIN</p>
                        <p className="text-sm font-semibold text-white">{dashboardData.speedStats.download.min} Mbps</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">MAX</p>
                        <p className="text-sm font-semibold text-white">{dashboardData.speedStats.download.max} Mbps</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">AVG</p>
                        <p className="text-sm font-semibold text-white">{dashboardData.speedStats.download.avg} Mbps</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-cyan-500/20 rounded-lg p-4 border border-cyan-500/30">
                    <h3 className="text-sm font-semibold text-cyan-300 mb-3">Upload Speed</h3>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-xs text-gray-400">MIN</p>
                        <p className="text-sm font-semibold text-white">{dashboardData.speedStats.upload.min} Mbps</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">MAX</p>
                        <p className="text-sm font-semibold text-white">{dashboardData.speedStats.upload.max} Mbps</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">AVG</p>
                        <p className="text-sm font-semibold text-white">{dashboardData.speedStats.upload.avg} Mbps</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      {/* Top Devices Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
          {dashboardData?.topDevices?.slowestLatencyIgw && (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl shadow-red-500/10 border border-red-500/20 p-6 hover:shadow-2xl hover:shadow-red-500/20 transition-all duration-300">
              <TopDevicesCard
                title={`Top 5 Highest near IGW Latency Devices (${getTimeRangeLabel()})`}
                data={dashboardData.topDevices.slowestLatencyIgw}
                unit="ms"
                accent="red"
                onDownload={() => downloadReport('worst-devices-igw')}
              />
            </div>
          )}

          {dashboardData?.topDevices?.slowestLatencyEbr && (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl shadow-orange-500/10 border border-orange-500/20 p-6 hover:shadow-2xl hover:shadow-orange-500/20 transition-all duration-300">
              <TopDevicesCard
                title={`Top 5 Highest near EBR Latency Devices (${getTimeRangeLabel()})`}
                data={dashboardData.topDevices.slowestLatencyEbr}
                unit="ms"
                accent="orange"
                onDownload={() => downloadReport('worst-devices-ebr')}
              />
            </div>
          )}

          {dashboardData?.topDevices?.highestPacketLoss && (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl shadow-amber-500/10 border border-amber-500/20 p-6 hover:shadow-2xl hover:shadow-amber-500/20 transition-all duration-300">
              <TopDevicesCard
                title={`Top 5 Highest Packet Loss Devices (${getTimeRangeLabel()})`}
                data={dashboardData.topDevices.highestPacketLoss}
                unit="%"
                accent="amber"
                onDownload={() => downloadReport('packet-loss-devices')}
              />
            </div>
          )}
        </div>

      {/* Below Threshold Devices Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {dashboardData?.topDevices?.belowDownloadThreshold && (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl shadow-rose-500/10 border border-rose-500/20 p-6 hover:shadow-2xl hover:shadow-rose-500/20 transition-all duration-300">
              <TopDevicesCard
                title={`Top 5 Download Below Threshold (${getTimeRangeLabel()})`}
                data={dashboardData.topDevices.belowDownloadThreshold}
                unit="Mbps"
                accent="red"
                onDownload={() => downloadReport('below-download-threshold')}
                showThreshold={true}
              />
            </div>
          )}

          {dashboardData?.topDevices?.belowUploadThreshold && (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl shadow-yellow-500/10 border border-yellow-500/20 p-6 hover:shadow-2xl hover:shadow-yellow-500/20 transition-all duration-300">
              <TopDevicesCard
                title={`Top 5 Upload Below Threshold (${getTimeRangeLabel()})`}
                data={dashboardData.topDevices.belowUploadThreshold}
                unit="Mbps"
                accent="orange"
                onDownload={() => downloadReport('below-upload-threshold')}
                showThreshold={true}
              />
            </div>
          )}
        </div>

      {/* ================================================================= */}
      {/* PHASE 3: DASHBOARD V2 — 7 Row Analytics (Hidden by default)         */}
      {/* ================================================================= */}
      {dashboardV2?.kpi && dashboardV2?.threshold && dashboardV2?.rootCause && dashboardV2?.topAlarms && (
        <>
          <button
            onClick={() => setShowPhase3(!showPhase3)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-xs text-gray-400 hover:text-gray-200 mb-4"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Advanced Analytics
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showPhase3 ? 'rotate-180' : ''}`} />
          </button>

          {showPhase3 && (
            <div className="space-y-6 mb-8">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <KPIBigCard title="Total Device" value={dashboardV2.kpi.total_device ?? 0} icon={Server} color="from-blue-500 to-blue-700" />
                <KPIBigCard title="Active Alarm" value={dashboardV2.kpi.active_alarm ?? 0} icon={Bell} color="from-red-500 to-red-700" />
                <KPIBigCard title="L1 Alarm" value={dashboardV2.kpi.l1_alarm ?? 0} icon={AlertTriangle} color="from-rose-600 to-red-800" />
                <KPIBigCard title="L2 Alarm" value={dashboardV2.kpi.l2_alarm ?? 0} icon={AlertCircle} color="from-amber-500 to-orange-700" />
                <KPIBigCard title="Availability" value={`${dashboardV2.kpi.availability || 0}%`} icon={Activity} color="from-green-500 to-emerald-700" />
                <KPIBigCard title="Last Check" value={dashboardV2.kpi.last_check ? new Date(dashboardV2.kpi.last_check).toLocaleTimeString('id-ID') : '-'} icon={Clock} color="from-purple-500 to-violet-700" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KPIBigCard title="Under Threshold" value={dashboardV2.threshold?.under_threshold ?? 0} icon={TrendingUp} color="from-cyan-500 to-teal-700" subtitle="Lower type" />
                <KPIBigCard title="Upper Threshold" value={dashboardV2.threshold?.upper_threshold ?? 0} icon={TrendingUp} color="from-orange-500 to-red-700" subtitle="Upper type" />
                <KPIBigCard title="Critical" value={dashboardV2.kpi.l1_alarm ?? 0} icon={AlertTriangle} color="from-red-600 to-rose-900" subtitle="Severity critical" />
                <KPIBigCard title="Warning" value={dashboardV2.kpi.l2_alarm ?? 0} icon={AlertCircle} color="from-amber-500 to-yellow-800" subtitle="Severity warning" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AlarmPieChart data={dashboardV2.rootCause ?? []} />
                <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-md p-5 shadow-lg shadow-amber-500/10">
                  <h3 className="text-lg font-bold text-white mb-4">Root Cause Summary</h3>
                  <div className="space-y-3">
                    {(dashboardV2.rootCause ?? []).slice(0, 8).map((item: any, i: number) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-sm text-gray-300 capitalize">{item.alarm_type?.replace(/_/g, ' ')}</span>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${item.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'}`} />
                          <span className="text-sm font-bold text-white">{item.count ?? 0}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <L1AvailabilityCard data={dashboardV2.l1l2 ?? []} />

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <TopAlarmCard title="Top Region Alarm" data={dashboardV2.topAlarms?.regions ?? []} icon={MapPin} />
                <TopAlarmCard title="Top NOP Alarm" data={dashboardV2.topAlarms?.nops ?? []} icon={Building2} />
                <TopAlarmCard title="Top Brand Alarm" data={dashboardV2.topAlarms?.brands ?? []} icon={Box} />
                <TopAlarmCard title="Top ONT Type Alarm" data={dashboardV2.topAlarms?.ontTypes ?? []} icon={Cpu} />
              </div>

              <PerformanceAnalytics data={dashboardV2.performance ?? { avg_latency: 0, avg_ebr_latency: 0, avg_packet_loss: 0, avg_availability: 0 }} />
            </div>
          )}
        </>
      )}

      </div>
    </div>
  )
}
