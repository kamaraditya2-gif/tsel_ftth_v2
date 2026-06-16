'use client'

import { Zap, ArrowUp, ArrowDown, Clock, Gauge as GaugeIcon, AlertTriangle } from 'lucide-react'

interface Device {
  id: number
  deviceName: string
  serialNumber: string | null
  indihomeId: string | null
  regionalName: string | null
  speedName: string | null
  value: number
}

interface TopDevicesProps {
  topDevices: {
    fastestLatency: Device[]
    slowestLatency: Device[]
    fastestUpload: Device[]
    slowestUpload: Device[]
    fastestDownload: Device[]
    slowestDownload: Device[]
    highestPacketLoss: Device[]
  }
}

export default function TopDevices({ topDevices }: TopDevicesProps) {
  const DeviceRow = ({ device, index, type }: { device: Device, index: number, type: string }) => {
    const getIcon = () => {
      switch (type) {
        case 'latency':
          return <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        case 'upload':
          return <ArrowUp className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        case 'download':
          return <ArrowDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        case 'packet_loss':
          return <AlertTriangle className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        default:
          return <Zap className="w-4 h-4 text-gray-500 dark:text-gray-400" />
      }
    }

    const getUnit = () => {
      switch (type) {
        case 'latency':
          return 'ms'
        case 'upload':
        case 'download':
          return 'Mbps'
        case 'packet_loss':
          return '%'
        default:
          return ''
      }
    }

    return (
      <div className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 w-6">#{index + 1}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {device.deviceName}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {device.indihomeId || device.serialNumber || `ID: ${device.id}`}
            </p>
            <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
              {device.regionalName && <span>{device.regionalName}</span>}
              {device.regionalName && device.speedName && <span>•</span>}
              {device.speedName && <span>{device.speedName}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <span className="text-sm font-bold text-gray-900 dark:text-white">
            {device.value.toFixed(2)} {getUnit()}
          </span>
          {getIcon()}
        </div>
      </div>
    )
  }

  const DeviceCard = ({ 
    title, 
    devices, 
    type, 
    icon: Icon, 
    color 
  }: { 
    title: string, 
    devices: Device[], 
    type: string, 
    icon: any, 
    color: string 
  }) => {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex items-center gap-2 mb-4">
          <Icon className={`w-5 h-5 ${color}`} />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
        </div>
        <div className="space-y-1">
          {devices.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-2 text-center">No data available</p>
          ) : (
            devices.map((device, index) => (
              <DeviceRow key={device.id} device={device} index={index} type={type} />
            ))
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <DeviceCard
        title="Slowest Latency"
        devices={topDevices.slowestLatency}
        type="latency"
        icon={Clock}
        color="text-red-600 dark:text-red-400"
      />
      <DeviceCard
        title="Highest Packet Loss"
        devices={topDevices.highestPacketLoss}
        type="packet_loss"
        icon={AlertTriangle}
        color="text-red-600 dark:text-red-400"
      />
      <DeviceCard
        title="Slowest Upload"
        devices={topDevices.slowestUpload}
        type="upload"
        icon={ArrowUp}
        color="text-red-600 dark:text-red-400"
      />
      <DeviceCard
        title="Slowest Download"
        devices={topDevices.slowestDownload}
        type="download"
        icon={ArrowDown}
        color="text-red-600 dark:text-red-400"
      />
    </div>
  )
}
