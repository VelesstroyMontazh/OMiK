import { NextRequest } from 'next/server'
import { proxyBackendRaw } from '@/lib/backend-proxy'

const TIMEOUT_MS = 300_000

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const params = new URLSearchParams()
  params.set('date', searchParams.get('date') || '')
  if (searchParams.get('location_id')) params.set('location_id', searchParams.get('location_id')!)
  if (searchParams.get('combined') === 'true') params.set('combined', 'true')
  return proxyBackendRaw(`/api/daily-tracking/export?${params}`, undefined, TIMEOUT_MS)
}
