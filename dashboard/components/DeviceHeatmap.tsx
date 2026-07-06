'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

interface MapDevice {
  id: number
  serial_number: string
  indihome_id: string | null
  status: string
  lat: number
  lng: number
  regional_name: string | null
  speed_name: string | null
  ping_igw: number | null
  download_speed: number | null
  upload_speed: number | null
  download_threshold: number | null
  upload_threshold: number | null
  avg_latency_ms: number | null
  packet_loss_percent: number | null
}

interface DownstreamServer {
  id: number
  name: string
  location: string
  province: string
  lat: number
  lng: number
  status: string
  icon: string
  color: string
}

interface DeviceHeatmapProps {
  timeRange?: string
  regionalId?: string
  areaId?: string
  nopId?: string
  areaIds?: string
  regionalIds?: string
  nopIds?: string
  speedGroupId?: string
  manufacturerId?: string
  ontModelId?: string
  serverId?: string
}

function getColor(device: MapDevice): string {
  if (device.status === 'offline') return '#ef4444'
  const dlOk = device.download_speed !== null && device.download_threshold !== null && Number(device.download_speed) >= Number(device.download_threshold)
  const ulOk = device.upload_speed !== null && device.upload_threshold !== null && Number(device.upload_speed) >= Number(device.upload_threshold)
  const pingOk = device.ping_igw !== null && device.ping_igw < 50
  const lossOk = device.packet_loss_percent !== null && device.packet_loss_percent < 3
  const latencyOk = device.avg_latency_ms !== null && device.avg_latency_ms < 50
  const passed = [dlOk, ulOk, pingOk, lossOk, latencyOk].filter(Boolean).length
  const total = [device.download_speed !== null || device.download_threshold !== null,
    device.upload_speed !== null || device.upload_threshold !== null,
    device.ping_igw !== null, device.packet_loss_percent !== null,
    device.avg_latency_ms !== null].filter(Boolean).length
  if (total === 0) return '#6b7280'
  const ratio = passed / total
  if (ratio >= 0.8) return '#22c55e'
  if (ratio >= 0.5) return '#eab308'
  return '#ef4444'
}

function getRadius(status: string): number {
  return status === 'offline' ? 16 : 12
}

export default function DeviceHeatmap({ timeRange = '24h', areaId, regionalId, nopId, areaIds, regionalIds, nopIds, speedGroupId, manufacturerId, ontModelId, serverId }: DeviceHeatmapProps) {
  const [devices, setDevices] = useState<MapDevice[]>([])
  const [servers, setServers] = useState<DownstreamServer[]>([])
  const [loading, setLoading] = useState(true)
  const [dataSource, setDataSource] = useState<'upstream' | 'downstream'>('upstream')
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const popupsRef = useRef<maplibregl.Popup[]>([])
  const lineSourceRef = useRef<string | null>(null)

  useEffect(() => {
    async function fetchDevices() {
      try {
        const params = new URLSearchParams({ timeRange, dataSource })
        if (areaIds) params.append('areaIds', areaIds)
        else if (areaId) params.append('areaId', areaId)
        if (regionalIds) params.append('regionalIds', regionalIds)
        else if (regionalId) params.append('regionalId', regionalId)
        if (nopIds) params.append('nopIds', nopIds)
        else if (nopId) params.append('nopId', nopId)
        if (speedGroupId) params.append('speedGroupId', speedGroupId)
        if (manufacturerId) params.append('manufacturerId', manufacturerId)
        if (ontModelId) params.append('ontModelId', ontModelId)
        if (serverId && dataSource === 'downstream') params.append('serverId', serverId)
        const res = await fetch(`/api/devices/map?${params.toString()}`)
        const data = await res.json()
        if (data.devices && Array.isArray(data.devices)) {
          setDevices(data.devices)
        } else {
          setDevices([])
        }
        if (data.servers && Array.isArray(data.servers)) {
          setServers(data.servers)
        }
      } catch (error) {
        console.error('Error fetching device map data:', error)
        setDevices([])
      } finally {
        setLoading(false)
      }
    }

    fetchDevices()
  }, [timeRange, areaId, regionalId, nopId, areaIds, regionalIds, nopIds, speedGroupId, manufacturerId, ontModelId, dataSource, serverId])

  useEffect(() => {
    if (!mapContainerRef.current) return
    if (typeof window === 'undefined') return

    if (!mapRef.current) {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: `https://api.maptiler.com/maps/streets-v2/style.json?key=3XChKc8u4YXTUmjuoqaP`,
        center: [118, -2.5],
        zoom: 5,
        attributionControl: false,
      })

      map.addControl(new maplibregl.NavigationControl(), 'bottom-right')
      mapRef.current = map
    }

    const map = mapRef.current

    // Clear existing markers and popups
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
    popupsRef.current.forEach(p => p.remove())
    popupsRef.current = []

    // Remove old line source and layer
    if (lineSourceRef.current) {
      try {
        if (map.getLayer('connection-lines')) map.removeLayer('connection-lines')
        if (map.getSource('connection-lines')) map.removeSource('connection-lines')
      } catch {}
      lineSourceRef.current = null
    }

    const validDevices = devices.filter(
      (d) => d.lat != null && d.lng != null && !isNaN(Number(d.lat)) && !isNaN(Number(d.lng))
    )

    if (validDevices.length > 0) {
      const lngs = validDevices.map(d => Number(d.lng))
      const lats = validDevices.map(d => Number(d.lat))
      const bounds: [[number, number], [number, number]] = [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ]
      map.fitBounds(bounds, { padding: 50, maxZoom: 16 })

      // Connection lines (downstream mode)
      if (dataSource === 'downstream') {
        const selectedServerObj = servers.find((s) => s.id === Number(serverId)) || servers.find((s) => s.status === 'active')
        if (selectedServerObj && selectedServerObj.lat && selectedServerObj.lng) {
          const lineFeatures: any[] = validDevices.map((device) => {
            const avgLatency = device.avg_latency_ms
            const lineColor = avgLatency !== null
              ? (avgLatency < 50 ? '#22c55e' : avgLatency < 100 ? '#eab308' : '#ef4444')
              : '#9ca3af'
            return {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: [
                  [Number(selectedServerObj.lng), Number(selectedServerObj.lat)],
                  [Number(device.lng), Number(device.lat)],
                ],
              },
              properties: { color: lineColor },
            }
          })

          try {
            map.addSource('connection-lines', {
              type: 'geojson',
              data: { type: 'FeatureCollection', features: lineFeatures },
            })
            map.addLayer({
              id: 'connection-lines',
              type: 'line',
              source: 'connection-lines',
              paint: {
                'line-color': ['get', 'color'],
                'line-width': 1.5,
                'line-opacity': 0.35,
                'line-dasharray': [4, 6],
              },
            })
            lineSourceRef.current = 'connection-lines'
          } catch (e) {
            console.error('Error adding connection lines:', e)
          }
        }
      }

      // Server markers
      servers.forEach((server) => {
        if (!server.lat || !server.lng) return
        const isActive = server.status === 'active'
        const isSelected = server.id === Number(serverId)
        const size = isSelected ? 32 : 22

        const el = document.createElement('div')
        el.style.width = `${size}px`
        el.style.height = `${size}px`
        el.style.borderRadius = '50%'
        el.style.background = isActive ? (server.color || '#ef4444') : '#6b7280'
        el.style.border = isSelected ? '4px solid #ffffff' : '2px solid #ffffff'
        el.style.boxShadow = `0 0 ${isSelected ? '16px' : '8px'} ${isActive ? (server.color || '#ef4444') : '#6b7280'}80`
        el.style.display = 'flex'
        el.style.alignItems = 'center'
        el.style.justifyContent = 'center'
        el.style.transition = 'all 0.2s'
        el.style.cursor = 'pointer'
        el.innerHTML = `<svg width="${size * 0.5}" height="${size * 0.5}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
          <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
          <line x1="6" y1="6" x2="6.01" y2="6"></line>
          <line x1="6" y1="18" x2="6.01" y2="18"></line>
        </svg>`

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([Number(server.lng), Number(server.lat)])
          .addTo(map)

        const popupHtml = `
          <div style="min-width:180px;font-family:system-ui,sans-serif">
            <div style="font-weight:600;font-size:14px;margin-bottom:4px">${server.name}</div>
            <div style="font-size:12px;color:#6b7280;margin-bottom:2px">${server.location}</div>
            <div style="font-size:12px;color:#6b7280;margin-bottom:4px">${server.province}</div>
            <span style="background:${isActive ? '#dcfce7' : '#f3f4f6'};color:${isActive ? '#166534' : '#6b7280'};padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:500">${server.status.toUpperCase()}</span>
            ${isSelected ? '<span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:500;margin-left:4px">SELECTED</span>' : ''}
          </div>
        `
        const popup = new maplibregl.Popup({ offset: 25 }).setHTML(popupHtml)
        marker.setPopup(popup)
        markersRef.current.push(marker)
      })

      // Device markers
      validDevices.forEach((device) => {
        const color = getColor(device)
        const radius = getRadius(device.status)
        const diameter = radius * 2

        const el = document.createElement('div')
        el.style.width = `${diameter}px`
        el.style.height = `${diameter}px`
        el.style.borderRadius = '50%'
        el.style.background = color
        el.style.border = '3px solid #ffffff'
        el.style.boxShadow = `0 0 0 3px rgba(0,0,0,0.4), 0 0 12px ${color}80`
        el.style.cursor = 'pointer'
        el.style.transition = 'box-shadow 0.15s'
        el.addEventListener('mouseenter', () => { el.style.boxShadow = `0 0 0 6px rgba(0,0,0,0.4), 0 0 20px ${color}80` })
        el.addEventListener('mouseleave', () => { el.style.boxShadow = `0 0 0 3px rgba(0,0,0,0.4), 0 0 12px ${color}80` })

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([Number(device.lng), Number(device.lat)])
          .addTo(map)

        const popupContent = `
          <div style="min-width:200px;font-family:system-ui,sans-serif">
            <div style="font-weight:600;font-size:14px;margin-bottom:4px">${device.serial_number}</div>
            <div style="font-size:11px;color:#6b7280;margin-bottom:6px">${device.indihome_id || ''}${device.regional_name ? ' · ' + device.regional_name : ''}</div>
            <table style="width:100%;font-size:11px;border-collapse:collapse">
              <tr><td style="padding:2px 4px;color:#6b7280">Status</td><td style="padding:2px 4px;text-align:right"><span style="background:${device.status === 'online' ? '#dcfce7' : '#fee2e2'};color:${device.status === 'online' ? '#166534' : '#991b1b'};padding:1px 6px;border-radius:9999px">${device.status.toUpperCase()}</span></td></tr>
              <tr><td style="padding:2px 4px;color:#6b7280">Speed</td><td style="padding:2px 4px;text-align:right;color:#374151">${device.speed_name || '-'}${device.speed_name ? ' (' + device.speed_name + ')' : ''}</td></tr>
              <tr><td style="padding:2px 4px;color:#6b7280">Ping IGW</td><td style="padding:2px 4px;text-align:right;color:#374151;font-weight:${device.ping_igw !== null && device.ping_igw > 50 ? 'bold;color:#ef4444' : 'normal'}">${device.ping_igw !== null ? device.ping_igw + ' ms' : '-'}</td></tr>
              <tr><td style="padding:2px 4px;color:#6b7280">Download</td><td style="padding:2px 4px;text-align:right;color:#374151;font-weight:${device.download_speed !== null && device.download_threshold !== null && Number(device.download_speed) < Number(device.download_threshold) ? 'bold;color:#ef4444' : 'normal'}">${device.download_speed !== null ? Number(device.download_speed).toFixed(1) + ' Mbps' : '-'}${device.download_threshold !== null ? ' / ' + Number(device.download_threshold).toFixed(0) + ' Mbps' : ''}</td></tr>
              <tr><td style="padding:2px 4px;color:#6b7280">Upload</td><td style="padding:2px 4px;text-align:right;color:#374151;font-weight:${device.upload_speed !== null && device.upload_threshold !== null && Number(device.upload_speed) < Number(device.upload_threshold) ? 'bold;color:#ef4444' : 'normal'}">${device.upload_speed !== null ? Number(device.upload_speed).toFixed(1) + ' Mbps' : '-'}${device.upload_threshold !== null ? ' / ' + Number(device.upload_threshold).toFixed(0) + ' Mbps' : ''}</td></tr>
              <tr><td style="padding:2px 4px;color:#6b7280">Packet Loss</td><td style="padding:2px 4px;text-align:right;color:#374151;font-weight:${device.packet_loss_percent !== null && device.packet_loss_percent > 3 ? 'bold;color:#ef4444' : 'normal'}">${device.packet_loss_percent !== null ? Number(device.packet_loss_percent).toFixed(1) + '%' : '-'}</td></tr>
              <tr><td style="padding:2px 4px;color:#6b7280">Direct Latency</td><td style="padding:2px 4px;text-align:right;color:#374151;font-weight:${device.avg_latency_ms !== null && device.avg_latency_ms > 50 ? 'bold;color:#ef4444' : 'normal'}">${device.avg_latency_ms !== null ? Number(device.avg_latency_ms).toFixed(1) + ' ms' : '-'}</td></tr>
            </table>
          </div>
        `

        const popup = new maplibregl.Popup({ offset: 15 }).setHTML(popupContent)
        marker.setPopup(popup)
        markersRef.current.push(marker)
      })
    }

    return () => {
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
      popupsRef.current.forEach(p => p.remove())
      popupsRef.current = []
      if (lineSourceRef.current && map) {
        try {
          if (map.getLayer('connection-lines')) map.removeLayer('connection-lines')
          if (map.getSource('connection-lines')) map.removeSource('connection-lines')
        } catch {}
        lineSourceRef.current = null
      }
    }
  }, [devices, dataSource, servers, serverId])

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Device Heatmap</h2>
        <div className="h-[500px] flex items-center justify-center">
          <div className="text-gray-500 dark:text-gray-400">Loading map...</div>
        </div>
      </div>
    )
  }

  const onlineCount = devices.filter((d) => d.status === 'online').length
  const offlineCount = devices.filter((d) => d.status === 'offline').length

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex flex-col gap-4 mb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Device Heatmap</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {devices.length} devices &middot;
            <span className="text-green-600 dark:text-green-400 ml-1">{onlineCount} online</span>
            <span className="text-red-600 dark:text-red-400 ml-1">{offlineCount} offline</span>
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 bg-gray-50 dark:bg-gray-900 self-start">
            <button onClick={() => setDataSource('upstream')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${dataSource === 'upstream' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}>Upstream</button>
            <button onClick={() => setDataSource('downstream')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${dataSource === 'downstream' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}>Downstream</button>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500"></span>≥80% OK</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-500"></span>50-80%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500"></span>&lt;50%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-500"></span>No data</span>
          </div>
        </div>
      </div>
      <div className="h-[500px] rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
        <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
      </div>
    </div>
  )
}
