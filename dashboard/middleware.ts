import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public paths that don't require authentication
  const publicPaths = ['/login', '/api/auth/login', '/api/auth/logout', '/api/app-settings', '/api/axiros-server', '/api/test-server', '/api/nop-cities', '/api/health']
  
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // Check for session cookie
  const session = request.cookies.get('user_session')
  
  if (!session) {
    // Redirect to login if no session
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api/auth/* (login/logout endpoints)
     * - api/app-settings (public API for app settings)
     * - api/axiros-server (public API for worker)
     * - api/test-server (public API for worker)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
     '/((?!api/auth|api/app-settings|api/axiros-server|api/test-server|api/nop-cities|api/health|_next/static|_next/image|favicon.ico|public).*)',
  ],
}
