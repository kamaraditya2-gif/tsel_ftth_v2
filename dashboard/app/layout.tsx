import './globals.css'
import type { Metadata } from 'next'
import { ThemeProvider } from '@/components/ThemeProvider'
import DashboardLayout from '@/components/DashboardLayout'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'

export async function generateMetadata(): Promise<Metadata> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/app-settings`, {
      cache: 'no-store',
    })
    const data = await res.json()
    return {
      title: data.app_name || 'Network Performance',
      description: 'Auto Configuration Server Monitoring Dashboard',
    }
  } catch (error) {
    return {
      title: 'Network Performance',
      description: 'Auto Configuration Server Monitoring Dashboard',
    }
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <ThemeProvider>
          <ServiceWorkerRegister />
          <DashboardLayout>{children}</DashboardLayout>
        </ThemeProvider>
      </body>
    </html>
  )
}
