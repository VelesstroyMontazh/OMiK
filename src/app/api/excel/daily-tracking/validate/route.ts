import { NextRequest } from 'next/server'
import { proxyBackend } from '@/lib/backend-proxy'

const TIMEOUT_MS = 120_000

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')
  if (!date) {
    return Response.json({ error: 'date required' }, { status: 400 })
  }
  const params = new URLSearchParams({ date })
  if (searchParams.get('location_id')) params.set('location_id', searchParams.get('location_id')!)
  if (searchParams.get('combined') === 'true') params.set('combined', 'true')
  return proxyBackend(`/api/daily-tracking/validate?${params}`, undefined, TIMEOUT_MS)
}
