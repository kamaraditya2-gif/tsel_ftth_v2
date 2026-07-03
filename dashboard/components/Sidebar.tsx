'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Server, Cpu, Settings, UserCircle, Users, Workflow, Moon, Sun, FileCode, LogOut, MapPin, FlaskConical, Clock, Zap, Gauge, Database, Building2, Box, BarChart3, Menu, X, Layers, Activity, Globe, Network, AlertTriangle, Download } from 'lucide-react'
import { useTheme } from './ThemeProvider'

const menuItems = [
  { section: 'Main Menu', items: [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Performance Test', href: '/testing/performance', icon: BarChart3 },
    { name: 'Devices', href: '/devices', icon: Server },
    { name: 'Alarms', href: '/alarms/v2', icon: AlertTriangle },
    { name: 'Reports', href: '/reports/v2', icon: FileCode },
  ]},
  { section: 'Testing', items: [
    { name: 'Scheduled Test', href: '/testing/scheduled', icon: Clock },
    { name: 'On Demand Test', href: '/testing/on-demand', icon: Zap },
    { name: 'Queueing', href: '/testing/queueing', icon: FlaskConical },
  ]},
  { section: 'Administrator', items: [
    { name: 'Setting', href: '/admin/setting', icon: Settings },
    { name: 'Threshold', href: '/admin/threshold', icon: AlertTriangle },
    { name: 'Scaling', href: '/admin/scaling', icon: Layers },
    { name: 'Manufacturer', href: '/admin/manufacturer', icon: Building2 },
    { name: 'ONT Model', href: '/admin/ont-model', icon: Box },
    { name: 'Master Area', href: '/admin/master-area', icon: Globe },
    { name: 'Master Cluster NOP', href: '/admin/master-cluster-nop', icon: Network },
    { name: 'Redis', href: '/admin/redis', icon: Database },
    { name: 'Regional Servers', href: '/admin/downstream-servers', icon: MapPin },
    { name: 'Bulk Assign Region', href: '/bulk-assign', icon: Users },
    { name: 'Worker', href: '/admin/worker', icon: Workflow },
    { name: 'Regionals', href: '/regional', icon: MapPin },
    { name: 'Speeds', href: '/speeds', icon: Gauge },
    { name: 'Download Raw Data', href: '/admin/download-data', icon: Download },
    { name: 'Health', href: '/admin/health', icon: Activity },
    { name: 'Users', href: '/admin/users', icon: UserCircle },
    { name: 'Roles', href: '/admin/roles', icon: Users },
  ]}
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const theme = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [appSettings, setAppSettings] = useState({
    app_name: 'Network Performancer',
    logo_url: null
  })
  const [userRole, setUserRole] = useState<string | null>(null)
  const [alarmCount, setAlarmCount] = useState(0)

  // Compute filtered menu items based on user role
  const filteredMenuItems = userRole === 'field'
    ? [{ section: 'Field', items: [{ name: 'Field Test', href: '/field', icon: MapPin }] }]
    : userRole === 'viewer'
    ? menuItems.filter(section => section.section !== 'Administrator')
    : userRole === 'operator'
    ? menuItems.map(section => {
        if (section.section === 'Administrator') {
          return {
            ...section,
            items: section.items.filter(item => !['Setting', 'Users', 'Roles'].includes(item.name))
          }
        }
        return section
      })
    : menuItems

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  useEffect(() => {
    setMounted(true)
    Promise.all([fetchAppSettings(), fetchUserRole(), fetchAlarmCount()])
    const interval = setInterval(fetchAlarmCount, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchAppSettings = async () => {
    try {
      const res = await fetch('/api/app-settings')
      const data = await res.json()
      setAppSettings({
        app_name: data.app_name || 'Network Performance',
        logo_url: data.logo_url || null
      })
    } catch (error) {
      console.error('Failed to fetch app settings:', error)
    }
  }

  const fetchUserRole = async () => {
    try {
      const res = await fetch('/api/user-role')
      const data = await res.json()
      setUserRole(data.role_name)
    } catch (error) {
      setUserRole(null)
    }
  }

  const fetchAlarmCount = async () => {
    try {
      const res = await fetch('/api/alarms/stats')
      const data = await res.json()
      setAlarmCount(data.total || 0)
    } catch (error) {
      setAlarmCount(0)
    }
  }


  if (!mounted) {
    return (
      <>
        {/* Mobile hamburger placeholder */}
        <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-gray-900/95 backdrop-blur-md border-b border-gray-800 z-40 flex items-center px-4">
          <div className="w-8 h-8" />
          <span className="ml-3 text-white font-semibold truncate">{appSettings.app_name}</span>
        </div>
        <div className="hidden lg:flex w-64 h-screen bg-gray-900 dark:bg-gray-950 fixed left-0 top-0 flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-800 dark:border-gray-800 flex-shrink-0">
            <div className="flex flex-col items-center">
              {appSettings.logo_url ? (
                <img
                  src={appSettings.logo_url}
                  alt="Logo"
                  className="w-25 h-20 object-contain rounded-lg"
                />
              ) : (
                <div className="w-25 h-20 bg-blue-500 rounded-lg flex items-center justify-center">
                  <Cpu className="w-12 h-12 text-white" />
                </div>
              )}
              <span className="text-gray-400 text-sm -mt-4">{appSettings.app_name}</span>
            </div>
          </div>

          <nav
            className="p-4 overflow-y-auto flex-1 min-h-0 custom-scrollbar"
          >
            <style dangerouslySetInnerHTML={{
              __html: `
                .custom-scrollbar::-webkit-scrollbar {
                  width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                  background: transparent;
                  border-radius: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                  background: #4B5563;
                  border-radius: 3px;
                  transition: background 0.2s ease;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                  background: #6B7280;
                }
                .custom-scrollbar {
                  scroll-behavior: smooth;
                }
              `
            }} />
            {filteredMenuItems.map((section) => {
              return (
                <div key={section.section} className="mb-6">
                  <h2 className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-3">
                    {section.section}
                  </h2>
                  <ul className="space-y-1">
                    {section.items.map((item) => {
                      const Icon = item.icon
                      const isActive = pathname === item.href
                      return (
                        <li key={item.name}>
                          <Link
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                              isActive
                                ? 'bg-gray-800 text-white'
                                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                            }`}
                          >
                            <Icon className="w-5 h-5" />
                            <span className="text-sm font-medium">{item.name}</span>
                            {item.name === 'Alarms' && alarmCount > 0 && (
                              <span className="ml-auto bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                                {alarmCount}
                              </span>
                            )}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </nav>

          <div className="p-4 border-t border-gray-800 dark:border-gray-800 flex-shrink-0 space-y-2">
            <button
              onClick={theme.toggleTheme}
              className="flex items-center gap-3 w-full px-3 py-2 text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition-colors"
              aria-label="Toggle mode"
            >
              {theme.theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              <span className="text-sm font-medium">Mode</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2 text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-gray-900/95 backdrop-blur-md border-b border-gray-800 z-40 flex items-center justify-between px-4">
        <div className="flex items-center gap-3 overflow-hidden">
          {appSettings.logo_url ? (
            <img src={appSettings.logo_url} alt="Logo" className="w-8 h-8 object-contain rounded" />
          ) : (
            <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center flex-shrink-0">
              <Cpu className="w-5 h-5 text-white" />
            </div>
          )}
          <span className="text-white font-semibold text-sm truncate">{appSettings.app_name}</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed top-0 left-0 bottom-0 z-50 w-64 bg-gray-900 dark:bg-gray-950 flex flex-col transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 border-b border-gray-800 dark:border-gray-800 flex-shrink-0">
          <div className="flex flex-col items-center">
            {appSettings.logo_url ? (
              <img
                src={appSettings.logo_url}
                alt="Logo"
                className="w-25 h-20 object-contain rounded-lg"
              />
            ) : (
              <div className="w-25 h-20 bg-blue-500 rounded-lg flex items-center justify-center">
                <Cpu className="w-12 h-12 text-white" />
              </div>
            )}
            <span className="text-gray-400 text-sm -mt-4">{appSettings.app_name}</span>
          </div>
        </div>

        <nav className="p-4 overflow-y-auto flex-1 custom-scrollbar">
          <style dangerouslySetInnerHTML={{
            __html: `
              .custom-scrollbar::-webkit-scrollbar {
                width: 6px;
              }
              .custom-scrollbar::-webkit-scrollbar-track {
                background: transparent;
                border-radius: 3px;
              }
              .custom-scrollbar::-webkit-scrollbar-thumb {
                background: #4B5563;
                border-radius: 3px;
                transition: background 0.2s ease;
              }
              .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                background: #6B7280;
              }
              .custom-scrollbar {
                scroll-behavior: smooth;
              }
            `
          }} />
          {filteredMenuItems.map((section) => (
            <div key={section.section} className="mb-6">
              <h2 className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-3">
                {section.section}
              </h2>
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                          isActive
                            ? 'bg-gray-800 text-white'
                            : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                        }`}
                      >
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm font-medium truncate">{item.name}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-800 dark:border-gray-800 flex-shrink-0 space-y-2">
          <button
            onClick={theme.toggleTheme}
            className="flex items-center gap-3 w-full px-3 py-2 text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition-colors"
            aria-label="Toggle mode"
          >
            {theme.theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            <span className="text-sm font-medium">Mode</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </div>
    </>
  )
}
