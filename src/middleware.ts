import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { checkIncomingApiAuth } from '@/lib/api-auth'

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/excel/')) {
    const denied = checkIncomingApiAuth(request)
    if (denied) return denied
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/api/excel/:path*'],
}
