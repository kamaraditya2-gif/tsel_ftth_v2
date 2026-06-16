'use client'

import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import AnimatedBackground from './AnimatedBackground'
import ChatbotWidget from './ChatbotWidget'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/login'

  if (isLoginPage) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen">
      <AnimatedBackground />
      <Sidebar />
      <main className="flex-1 lg:ml-64 pt-16 lg:pt-0 relative z-10">
        {children}
      </main>
      <ChatbotWidget />
    </div>
  )
}
