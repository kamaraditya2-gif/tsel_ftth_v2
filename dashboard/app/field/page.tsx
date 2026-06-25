'use client'

import { useState, useEffect, useRef } from 'react'
import { MapPin, Radio, Zap, Crosshair, Loader2, Wifi, Activity, ArrowUp, ArrowDown, Route } from 'lucide-react'

interface Device {
  id: number
  device_name: string
  serial_number: string
  indihome_id: string
  cpe_type: string
  manufacturer: string
  model: string
  lat: number
  lng: number
  regional_name: string
  regional_code: string
  speed_name: string
  speed_limit: number
  distance_km: number
}

interface TestResult {
  ping: { ping_igw: number; ping_ebr: number; packet_loss_igw: number; packet_loss_ebr: number; success: boolean; executed_at: string } | null
  traceroute: { traceroute_raw: any; total_hops: number; total_rtt_ms: number; success: boolean; executed_at: string } | null
  download: { download_speed: number; download_threshold: number; success: boolean; executed_at: string } | null
  upload: { upload_speed: number; upload_threshold: number; success: boolean; executed_at: string } | null
  directPing: { avg_latency_ms: number; packet_loss_percent: number; executed_at: string } | null
}

type TestPhase = 'idle' | 'locating' | 'located' | 'creating' | 'running' | 'polling' | 'completed' | 'error'

export default function FieldPage() {
  const [phase, setPhase] = useState<TestPhase>('idle')
  const [error, setError] = useState('')
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLng, setUserLng] = useState<number | null>(null)
  const [nearestDevice, setNearestDevice] = useState<Device | null>(null)
  const [taskId, setTaskId] = useState<number | null>(null)
  const [results, setResults] = useState<TestResult | null>(null)
  const [partialResults, setPartialResults] = useState<TestResult | null>(null)
  const [historicalResults, setHistoricalResults] = useState<TestResult | null>(null)
  const [progressText, setProgressText] = useState('')
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const sinceRef = useRef<string>('')

  const [manualLat, setManualLat] = useState('')
  const [manualLng, setManualLng] = useState('')
  const [locationInfo, setLocationInfo] = useState<string>('')

  const fetchNearest = async (lat: number, lng: number) => {
    setUserLat(lat)
    setUserLng(lng)
    setError('')
    try {
      const res = await fetch(`/api/devices/nearest?lat=${lat}&lng=${lng}`)
      const data = await res.json()
      if (res.ok && data.device) {
        setNearestDevice(data.device)
        setPhase('located')
      } else {
        setError(data.error || 'No nearby ONT found')
        setPhase('error')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to find nearest ONT')
      setPhase('error')
    }
  }

  const handleLocate = async () => {
    setPhase('locating')
    setError('')

    // Try browser geolocation first
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          setLocationInfo(`GPS: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`)
          await fetchNearest(position.coords.latitude, position.coords.longitude)
        },
        async (err) => {
          console.error('Browser geolocation failed:', err.message)
          // Fallback to IP geolocation
          await tryIpGeolocation()
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    } else {
      await tryIpGeolocation()
    }
  }

  const tryIpGeolocation = async () => {
    try {
      console.log('Trying IP geolocation...')
      const res = await fetch('https://ipapi.co/json/')
      const data = await res.json()
      if (data.latitude && data.longitude) {
        console.log(`IP geolocation success: ${data.latitude}, ${data.longitude}`)
        const loc = [data.city, data.region, data.country_name].filter(Boolean).join(', ')
        setLocationInfo(loc || `IP Location: ${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}`)
        await fetchNearest(data.latitude, data.longitude)
      } else {
        setError('Unable to detect location. Please enter coordinates manually.')
        setPhase('error')
      }
    } catch (err) {
      console.error('IP geolocation failed:', err)
      setError('Unable to detect location. Please enter coordinates manually.')
      setPhase('error')
    }
  }

  const handleManualLocate = async () => {
    const lat = parseFloat(manualLat)
    const lng = parseFloat(manualLng)
    if (isNaN(lat) || isNaN(lng)) {
      setError('Please enter valid latitude and longitude')
      return
    }
    await fetchNearest(lat, lng)
  }

  const startTest = async () => {
    if (!nearestDevice) return
    setPhase('creating')
    setProgressText('Creating test task...')
    setResults(null)
    setPartialResults(null)

    // Step 0: Fetch historical data first so user sees something while waiting
    await fetchHistorical(nearestDevice.id)

    try {
      const createRes = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Field Test - ${nearestDevice.serial_number}`,
          task_type: 'ondemand',
          test_type: 'ping,traceroute,download,upload',
          device_id: nearestDevice.id,
        })
      })

      if (!createRes.ok) {
        const errData = await createRes.json()
        throw new Error(errData.error || 'Failed to create task')
      }

      const task = await createRes.json()
      setTaskId(task.id)

      setPhase('running')
      setProgressText('Dispatching tests to worker...')
      const runRes = await fetch(`/api/tasks/${task.id}/run`, { method: 'POST' })
      if (!runRes.ok) {
        const errData = await runRes.json()
        throw new Error(errData.error || 'Failed to run task')
      }

      const runTask = await runRes.json()
      // Use task started_at as the since marker so partial results
      // are picked up even if executed_at (queue_jobs.created_at) is
      // slightly earlier than the browser clock.
      sinceRef.current = runTask.started_at || new Date().toISOString()

      setPhase('polling')
      setProgressText('Running tests...')
      pollStatus(task.id, nearestDevice.id)
    } catch (err: any) {
      setError(err.message || 'Test failed to start')
      setPhase('error')
    }
  }

  const pollStatus = (tid: number, deviceId: number) => {
    let attempts = 0
    const maxAttempts = 120

    const check = async () => {
      attempts++
      try {
        const qRes = await fetch(`/api/queue-jobs?task_id=${tid}&limit=50`)
        const qData = await qRes.json()
        const jobs = qData.data || []

        const total = jobs.length
        const completed = jobs.filter((j: any) => j.status === 'completed').length
        const failed = jobs.filter((j: any) => j.status === 'failed').length

        if (total > 0) {
          setProgressText(`Progress: ${completed + failed}/${total} tests completed`)
        }

        // Fetch partial results every check so user sees data as it arrives
        if (total > 0 && (completed > 0 || failed > 0)) {
          try {
            const rRes = await fetch(`/api/field-test-results/${deviceId}?since=${encodeURIComponent(sinceRef.current)}`)
            const rData = await rRes.json()
            setPartialResults(rData)
          } catch (e) {
            // ignore partial fetch errors
          }
        }

        // Also fetch latest queue job details to detect "Device Not Ready"
        if (total > 0) {
          const failedJobs = jobs.filter((j: any) => j.status === 'failed')
          for (const job of failedJobs) {
            if (job.last_error?.includes('Device Not Ready')) {
              console.log(`Job ${job.id} failed: Device Not Ready`)
            }
          }
        }

        if (total > 0 && completed + failed === total) {
          const rRes = await fetch(`/api/field-test-results/${deviceId}?since=${encodeURIComponent(sinceRef.current)}`)
          const rData = await rRes.json()
          setResults(rData)
          setPartialResults(null)
          setPhase('completed')
          if (pollRef.current) clearInterval(pollRef.current)
          return
        }

        if (attempts >= maxAttempts) {
          setError('Test is taking too long. Please check results later.')
          setPhase('error')
          if (pollRef.current) clearInterval(pollRef.current)
          return
        }
      } catch (e) {
        // ignore polling errors
      }
    }

    check()
    pollRef.current = setInterval(check, 3000)
  }

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const reset = () => {
    if (pollRef.current) clearInterval(pollRef.current)
    setPhase('idle')
    setError('')
    setNearestDevice(null)
    setTaskId(null)
    setResults(null)
    setPartialResults(null)
    setHistoricalResults(null)
    setProgressText('')
    setLocationInfo('')
  }

  const fetchHistorical = async (deviceId: number) => {
    try {
      const res = await fetch(`/api/field-test-results/${deviceId}?includeHistorical=true`)
      const data = await res.json()
      if (data.historical) {
        setHistoricalResults(data.historical)
      }
    } catch (e) {
      console.error('Failed to fetch historical data:', e)
    }
  }

  return (
    <div className="min-h-screen p-4 md:p-6 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 w-full max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 shadow-lg shadow-cyan-500/20">
            <Crosshair className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Field Test</h1>
          <p className="text-gray-400 text-sm mt-1">Locate & test nearest ONT</p>
        </div>

        {/* Error / Manual Input */}
        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-200 text-sm text-center backdrop-blur-md">
            {error}
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  type="number"
                  step="any"
                  placeholder="Latitude"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-800/80 border border-red-500/30 text-white placeholder-gray-500 text-sm"
                />
                <input
                  type="number"
                  step="any"
                  placeholder="Longitude"
                  value={manualLng}
                  onChange={(e) => setManualLng(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-800/80 border border-red-500/30 text-white placeholder-gray-500 text-sm"
                />
              </div>
              <button
                onClick={handleManualLocate}
                className="w-full py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition"
              >
                Use Coordinates
              </button>
            </div>
            <button onClick={reset} className="block mx-auto mt-2 text-xs text-red-300 underline">Reset</button>
          </div>
        )}

        {/* IDLE / LOCATING */}
        {(phase === 'idle' || phase === 'locating') && (
          <div className="flex flex-col items-center gap-6">
            <button
              onClick={handleLocate}
              disabled={phase === 'locating'}
              className="relative group"
            >
              <div className="absolute inset-0 bg-cyan-500/30 rounded-full blur-xl animate-pulse group-hover:bg-cyan-500/50 transition-all" />
              <div className="relative w-40 h-40 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex flex-col items-center justify-center shadow-2xl shadow-cyan-500/30 hover:scale-105 transition-transform duration-300">
                {phase === 'locating' ? (
                  <Loader2 className="w-10 h-10 text-white animate-spin" />
                ) : (
                  <MapPin className="w-10 h-10 text-white" />
                )}
                <span className="text-white font-semibold mt-2 text-sm">
                  {phase === 'locating' ? 'Locating...' : 'Locate Me'}
                </span>
              </div>
            </button>
            <p className="text-gray-400 text-sm text-center">Tap to find your location and nearest ONT</p>
          </div>
        )}

        {/* LOCATED - Show nearest ONT */}
        {nearestDevice && phase !== 'idle' && phase !== 'locating' && (
          <div className="space-y-6">
            {/* Location Info */}
            {locationInfo && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 backdrop-blur-md">
                <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="text-sm text-cyan-200">{locationInfo}</span>
              </div>
            )}

            {/* ONT Card */}
            <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-md p-5 shadow-lg shadow-purple-500/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Radio className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-white font-semibold">Nearest ONT</h2>
                  <p className="text-xs text-gray-400">{nearestDevice.distance_km.toFixed(2)} km away</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Device</span>
                  <span className="text-white font-medium">{nearestDevice.device_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Serial</span>
                  <span className="text-white font-medium">{nearestDevice.serial_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Regional</span>
                  <span className="text-white font-medium">{nearestDevice.regional_name || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Speed</span>
                  <span className="text-white font-medium">{nearestDevice.speed_name || '-'}</span>
                </div>
              </div>
            </div>

            {/* Start Test Button */}
            {(phase === 'located' || phase === 'error') && (
              <div className="flex flex-col items-center gap-4">
                <button
                  onClick={startTest}
                  className="relative group"
                >
                  <div className="absolute inset-0 bg-green-500/30 rounded-full blur-xl animate-pulse group-hover:bg-green-500/50 transition-all" />
                  <div className="relative w-36 h-36 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex flex-col items-center justify-center shadow-2xl shadow-green-500/30 hover:scale-105 transition-transform duration-300">
                    <Zap className="w-10 h-10 text-white" />
                    <span className="text-white font-semibold mt-2 text-sm">Start Test</span>
                  </div>
                </button>
                <button onClick={reset} className="text-xs text-gray-400 underline hover:text-gray-300">Re-locate</button>
              </div>
            )}

            {/* Running / Polling / Completed — unified results view */}
            {(phase === 'creating' || phase === 'running' || phase === 'polling' || phase === 'completed') && (
              <div className="w-full space-y-4">
                {phase !== 'completed' && (
                  <div className="flex flex-col items-center gap-4 mb-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-yellow-500/20 rounded-full blur-xl animate-pulse" />
                      <div className="relative w-32 h-32 rounded-full border-4 border-yellow-500/30 border-t-yellow-400 flex items-center justify-center animate-spin">
                        <div className="w-24 h-24 rounded-full bg-slate-900 flex flex-col items-center justify-center">
                          <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" style={{ animationDirection: 'reverse' }} />
                        </div>
                      </div>
                    </div>
                    <p className="text-yellow-300 font-medium text-sm animate-pulse">{progressText}</p>
                  </div>
                )}

                {phase === 'completed' && (
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-semibold">Test Results</h3>
                    <button onClick={reset} className="text-xs text-cyan-400 underline hover:text-cyan-300">New Test</button>
                  </div>
                )}

                {/* Ping — show partial/latest or historical fallback */}
                {(() => {
                  const p = partialResults?.ping || results?.ping
                  const h = historicalResults?.ping
                  if (p) {
                    return (
                      <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-md p-4 shadow-lg shadow-blue-500/10">
                        <div className="flex items-center gap-2 mb-2">
                          <Activity className="w-4 h-4 text-blue-400" />
                          <span className="text-sm font-medium text-blue-300">Ping ✅</span>
                          {h && p.executed_at === h.executed_at && <span className="text-[10px] bg-gray-600/50 text-gray-300 px-2 py-0.5 rounded-full ml-auto">Last known</span>}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="bg-blue-500/10 rounded-lg p-2 text-center"><p className="text-xs text-gray-400">near IGW</p><p className="text-white font-bold">{p.ping_igw} ms</p></div>
                          <div className="bg-blue-500/10 rounded-lg p-2 text-center"><p className="text-xs text-gray-400">near EBR</p><p className="text-white font-bold">{p.ping_ebr} ms</p></div>
                          <div className="bg-blue-500/10 rounded-lg p-2 text-center"><p className="text-xs text-gray-400">Loss near IGW</p><p className="text-white font-bold">{p.packet_loss_igw}%</p></div>
                          <div className="bg-blue-500/10 rounded-lg p-2 text-center"><p className="text-xs text-gray-400">Loss near EBR</p><p className="text-white font-bold">{p.packet_loss_ebr}%</p></div>
                        </div>
                      </div>
                    )
                  }
                  if (h) {
                    return (
                      <div className="rounded-2xl border border-blue-500/10 bg-slate-800/40 backdrop-blur-md p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Activity className="w-4 h-4 text-blue-400/50" />
                          <span className="text-sm font-medium text-blue-300/70">Ping</span>
                          <span className="text-[10px] bg-yellow-600/30 text-yellow-300 px-2 py-0.5 rounded-full ml-auto">Running...</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm opacity-60">
                          <div className="bg-blue-500/5 rounded-lg p-2 text-center"><p className="text-xs text-gray-500">near IGW</p><p className="text-white font-bold">{h.ping_igw} ms</p></div>
                          <div className="bg-blue-500/5 rounded-lg p-2 text-center"><p className="text-xs text-gray-500">near EBR</p><p className="text-white font-bold">{h.ping_ebr} ms</p></div>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-2">Showing last known data</p>
                      </div>
                    )
                  }
                  return (
                    <div className="rounded-2xl border border-blue-500/10 bg-slate-800/40 backdrop-blur-md p-4">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-400">Ping — waiting...</span>
                      </div>
                    </div>
                  )
                })()}

                {/* Traceroute — show partial/latest or historical fallback */}
                {(() => {
                  const t = partialResults?.traceroute || results?.traceroute
                  const h = historicalResults?.traceroute
                  const hasHops = (t?.total_hops ?? 0) > 0 || (h?.total_hops ?? 0) > 0
                  if (t && hasHops) {
                    return (
                      <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-md p-4 shadow-lg shadow-purple-500/10">
                        <div className="flex items-center gap-2 mb-2">
                          <Route className="w-4 h-4 text-purple-400" />
                          <span className="text-sm font-medium text-purple-300">Traceroute ✅</span>
                          {h && t.executed_at === h.executed_at && <span className="text-[10px] bg-gray-600/50 text-gray-300 px-2 py-0.5 rounded-full ml-auto">Last known</span>}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="bg-purple-500/10 rounded-lg p-2 text-center"><p className="text-xs text-gray-400">Hops</p><p className="text-white font-bold">{t.total_hops}</p></div>
                          <div className="bg-purple-500/10 rounded-lg p-2 text-center"><p className="text-xs text-gray-400">Total RTT</p><p className="text-white font-bold">{t.total_rtt_ms} ms</p></div>
                        </div>
                      </div>
                    )
                  }
                  if (h && h.total_hops > 0) {
                    return (
                      <div className="rounded-2xl border border-purple-500/10 bg-slate-800/40 backdrop-blur-md p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Route className="w-4 h-4 text-purple-400/50" />
                          <span className="text-sm font-medium text-purple-300/70">Traceroute</span>
                          <span className="text-[10px] bg-yellow-600/30 text-yellow-300 px-2 py-0.5 rounded-full ml-auto">Running...</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm opacity-60">
                          <div className="bg-purple-500/5 rounded-lg p-2 text-center"><p className="text-xs text-gray-500">Hops</p><p className="text-white font-bold">{h.total_hops}</p></div>
                          <div className="bg-purple-500/5 rounded-lg p-2 text-center"><p className="text-xs text-gray-500">Total RTT</p><p className="text-white font-bold">{h.total_rtt_ms} ms</p></div>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-2">Showing last known path</p>
                      </div>
                    )
                  }
                  return (
                    <div className="rounded-2xl border border-purple-500/10 bg-slate-800/40 backdrop-blur-md p-4">
                      <div className="flex items-center gap-2">
                        <Route className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-400">Traceroute — waiting...</span>
                      </div>
                    </div>
                  )
                })()}

                {/* Download — show partial/latest or historical fallback or Not Ready */}
                {(() => {
                  const d = partialResults?.download || results?.download
                  const h = historicalResults?.download
                  const isFailed = partialResults?.download?.success === false || results?.download?.success === false
                  if (d && !isFailed) {
                    return (
                      <div className="rounded-2xl border border-green-500/20 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-md p-4 shadow-lg shadow-green-500/10">
                        <div className="flex items-center gap-2 mb-2">
                          <ArrowDown className="w-4 h-4 text-green-400" />
                          <span className="text-sm font-medium text-green-300">Download ✅</span>
                          {h && d.executed_at === h.executed_at && <span className="text-[10px] bg-gray-600/50 text-gray-300 px-2 py-0.5 rounded-full ml-auto">Last known</span>}
                        </div>
                        <div className="bg-green-500/10 rounded-lg p-2 text-center">
                          <p className="text-xl font-bold text-white">{d.download_speed} Mbps</p>
                        </div>
                      </div>
                    )
                  }
                  if (isFailed) {
                    return (
                      <div className="rounded-2xl border border-red-500/20 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-md p-4 shadow-lg shadow-red-500/10">
                        <div className="flex items-center gap-2 mb-2">
                          <ArrowDown className="w-4 h-4 text-red-400" />
                          <span className="text-sm font-medium text-red-300">Download ❌</span>
                          <span className="text-[10px] bg-red-600/30 text-red-200 px-2 py-0.5 rounded-full ml-auto">Device Not Ready</span>
                        </div>
                        {h ? (
                          <div className="bg-green-500/5 rounded-lg p-2 text-center opacity-60">
                            <p className="text-lg font-bold text-white">{h.download_speed} Mbps</p>
                            <p className="text-[10px] text-gray-500">Last known data</p>
                          </div>
                        ) : (
                          <p className="text-sm text-red-200/70">Failed to get data — device was not ready for download test</p>
                        )}
                      </div>
                    )
                  }
                  if (h) {
                    return (
                      <div className="rounded-2xl border border-green-500/10 bg-slate-800/40 backdrop-blur-md p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <ArrowDown className="w-4 h-4 text-green-400/50" />
                          <span className="text-sm font-medium text-green-300/70">Download</span>
                          <span className="text-[10px] bg-yellow-600/30 text-yellow-300 px-2 py-0.5 rounded-full ml-auto">Running...</span>
                        </div>
                        <div className="bg-green-500/5 rounded-lg p-2 text-center opacity-60">
                          <p className="text-lg font-bold text-white">{h.download_speed} Mbps</p>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-2">Showing last known data</p>
                      </div>
                    )
                  }
                  return (
                    <div className="rounded-2xl border border-green-500/10 bg-slate-800/40 backdrop-blur-md p-4">
                      <div className="flex items-center gap-2">
                        <ArrowDown className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-400">Download — waiting...</span>
                      </div>
                    </div>
                  )
                })()}

                {/* Upload — show partial/latest or historical fallback or Not Ready */}
                {(() => {
                  const u = partialResults?.upload || results?.upload
                  const h = historicalResults?.upload
                  const isFailed = partialResults?.upload?.success === false || results?.upload?.success === false
                  if (u && !isFailed) {
                    return (
                      <div className="rounded-2xl border border-yellow-500/20 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-md p-4 shadow-lg shadow-yellow-500/10">
                        <div className="flex items-center gap-2 mb-2">
                          <ArrowUp className="w-4 h-4 text-yellow-400" />
                          <span className="text-sm font-medium text-yellow-300">Upload ✅</span>
                          {h && u.executed_at === h.executed_at && <span className="text-[10px] bg-gray-600/50 text-gray-300 px-2 py-0.5 rounded-full ml-auto">Last known</span>}
                        </div>
                        <div className="bg-yellow-500/10 rounded-lg p-2 text-center">
                          <p className="text-xl font-bold text-white">{u.upload_speed} Mbps</p>
                        </div>
                      </div>
                    )
                  }
                  if (isFailed) {
                    return (
                      <div className="rounded-2xl border border-red-500/20 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-md p-4 shadow-lg shadow-red-500/10">
                        <div className="flex items-center gap-2 mb-2">
                          <ArrowUp className="w-4 h-4 text-red-400" />
                          <span className="text-sm font-medium text-red-300">Upload ❌</span>
                          <span className="text-[10px] bg-red-600/30 text-red-200 px-2 py-0.5 rounded-full ml-auto">Device Not Ready</span>
                        </div>
                        {h ? (
                          <div className="bg-yellow-500/5 rounded-lg p-2 text-center opacity-60">
                            <p className="text-lg font-bold text-white">{h.upload_speed} Mbps</p>
                            <p className="text-[10px] text-gray-500">Last known data</p>
                          </div>
                        ) : (
                          <p className="text-sm text-red-200/70">Failed to get data — device was not ready for upload test</p>
                        )}
                      </div>
                    )
                  }
                  if (h) {
                    return (
                      <div className="rounded-2xl border border-yellow-500/10 bg-slate-800/40 backdrop-blur-md p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <ArrowUp className="w-4 h-4 text-yellow-400/50" />
                          <span className="text-sm font-medium text-yellow-300/70">Upload</span>
                          <span className="text-[10px] bg-yellow-600/30 text-yellow-300 px-2 py-0.5 rounded-full ml-auto">Running...</span>
                        </div>
                        <div className="bg-yellow-500/5 rounded-lg p-2 text-center opacity-60">
                          <p className="text-lg font-bold text-white">{h.upload_speed} Mbps</p>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-2">Showing last known data</p>
                      </div>
                    )
                  }
                  return (
                    <div className="rounded-2xl border border-yellow-500/10 bg-slate-800/40 backdrop-blur-md p-4">
                      <div className="flex items-center gap-2">
                        <ArrowUp className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-400">Upload — waiting...</span>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
