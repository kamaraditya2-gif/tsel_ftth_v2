import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function useRequireAdmin() {
  const router = useRouter()
  
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const res = await fetch('/api/user-role')
        const data = await res.json()
        
        const adminRoles = ['admin', 'Administrator', 'Admin']
        if (!adminRoles.includes(data.role_name)) {
          router.push('/')
        }
      } catch (error) {
        console.error('Error checking admin role:', error)
        router.push('/login')
      }
    }
    
    checkAdmin()
  }, [router])
}
