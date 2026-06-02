import { NextRequest, NextResponse } from 'next/server'
import { proxyBackend } from '@/lib/backend-proxy'

const TIMEOUT_MS = 300_000

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') || 'list'
  switch (action) {
    case 'sites': {
      const params = new URLSearchParams()
      params.set('active_only', searchParams.get('active_only') ?? 'true')
      if (searchParams.get('detailed') === 'true') params.set('detailed', 'true')
      return proxyBackend(`/api/daily-tracking/sites?${params}`, undefined, TIMEOUT_MS)
    }
    case 'stats': {
      const params = new URLSearchParams()
      params.set('date', searchParams.get('date') || '')
      if (searchParams.get('location_id')) params.set('location_id', searchParams.get('location_id')!)
      if (searchParams.get('combined') === 'true') params.set('combined', 'true')
      return proxyBackend(`/api/daily-tracking/stats?${params}`, undefined, TIMEOUT_MS)
    }
    case 'list': {
      const params = new URLSearchParams()
      params.set('date', searchParams.get('date') || '')
      if (searchParams.get('location_id')) params.set('location_id', searchParams.get('location_id')!)
      if (searchParams.get('combined') === 'true') params.set('combined', 'true')
      params.set('limit', searchParams.get('limit') || '5000')
      params.set('offset', searchParams.get('offset') || '0')
      return proxyBackend(`/api/daily-tracking?${params}`, undefined, TIMEOUT_MS)
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')
  const locationId = searchParams.get('location_id')
  const combined = searchParams.get('combined') === 'true'
  if (!date || (!locationId && !combined)) {
    return NextResponse.json(
      { error: 'date required; for single site — location_id, for «Общий» — combined=true' },
      { status: 400 },
    )
  }
  const params = new URLSearchParams({ date })
  if (locationId) params.set('location_id', locationId)
  if (combined) params.set('combined', 'true')
  const userRole = searchParams.get('user_role')
  const userSites = searchParams.get('user_sites')
  if (userRole) params.set('user_role', userRole)
  if (userSites) params.set('user_sites', userSites)
  return proxyBackend(`/api/daily-tracking/data?${params}`, { method: 'DELETE' }, TIMEOUT_MS)
}

export async function POST(request: NextRequest) {
  const form = await request.formData()
  const file = form.get('file')
  const locationId = form.get('location_id')
  const date = form.get('date')
  const confirm = form.get('confirm') === 'true'
  const replaceSiteDate = form.get('replace_site_date') === 'true'
  const userRole = form.get('user_role')
  const userSites = form.get('user_sites')
  if (!file || !(file instanceof Blob) || !locationId || !date) {
    return NextResponse.json({ error: 'file, location_id, date required' }, { status: 400 })
  }
  const buf = Buffer.from(await file.arrayBuffer())
  const name = file instanceof File ? file.name : 'daily.xlsx'
  const body = new FormData()
  body.append('file', new Blob([buf]), name)
  const params = new URLSearchParams({
    location_id: String(locationId),
    date: String(date),
    confirm: String(confirm),
    replace_site_date: String(replaceSiteDate),
  })
  if (userRole) params.set('user_role', String(userRole))
  if (userSites) params.set('user_sites', String(userSites))
  return proxyBackend(`/api/daily-tracking/upload?${params}`, {
    method: 'POST',
    body,
  }, TIMEOUT_MS)
}
