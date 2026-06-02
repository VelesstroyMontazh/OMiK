import { NextRequest } from 'next/server'
import { proxyBackend } from '@/lib/backend-proxy'

const TIMEOUT_MS = 300_000

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')
  if (!date) {
    return Response.json({ error: 'date required' }, { status: 400 })
  }
  const params = new URLSearchParams({ date })
  const userRole = searchParams.get('user_role')
  if (userRole) params.set('user_role', userRole)
  return proxyBackend(`/api/daily-tracking/combined/build?${params}`, { method: 'POST' }, TIMEOUT_MS)
}
