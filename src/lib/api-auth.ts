import { NextResponse } from 'next/server'

/** Optional shared secret for /api/excel/* (set OMIK_API_SECRET in .env.local). */
export function getApiSecret(): string {
  return (process.env.OMIK_API_SECRET || '').trim()
}

export function apiSecretHeaders(): HeadersInit {
  const secret = getApiSecret()
  if (!secret) return {}
  return { 'X-OMIK-Token': secret }
}

/** Reject unauthenticated requests when OMIK_API_SECRET is configured. */
export function checkIncomingApiAuth(request: Request): NextResponse | null {
  const secret = getApiSecret()
  if (!secret) return null
  const token =
    request.headers.get('x-omik-token') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    ''
  if (token !== secret) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }
  return null
}
