import { NextRequest, NextResponse } from 'next/server'
import { proxyBackend } from '@/lib/backend-proxy'

const STATUS_TIMEOUT_MS = 30_000
const LOAD_TIMEOUT_MS = 600_000
const DATA_TIMEOUT_MS = 120_000

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') || 'status'

  switch (action) {
    case 'status': {
      const registry = searchParams.get('registry')
      const qs = registry ? `?registry=${encodeURIComponent(registry)}` : ''
      return proxyBackend(`/api/tickets-registry/status${qs}`, undefined, STATUS_TIMEOUT_MS)
    }
    case 'data': {
      const params = new URLSearchParams()
      const registry = searchParams.get('registry') || 'vsm'
      const search = searchParams.get('search')
      const offset = searchParams.get('offset') || '0'
      const limit = searchParams.get('limit') || '200'
      params.set('registry', registry)
      if (search) params.set('search', search)
      params.set('offset', offset)
      params.set('limit', limit)
      return proxyBackend(`/api/tickets-registry/data?${params.toString()}`, undefined, DATA_TIMEOUT_MS)
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const action = body.action as string

  if (action === 'load') {
    return proxyBackend(
      '/api/tickets-registry/load',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_path: body.file_path,
          registry: body.registry || 'vsm',
          sheet_name: body.sheet_name,
        }),
      },
      LOAD_TIMEOUT_MS,
    )
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const registry = searchParams.get('registry')
  const qs = registry ? `?registry=${encodeURIComponent(registry)}` : ''
  return proxyBackend(`/api/tickets-registry/clear${qs}`, { method: 'DELETE' }, STATUS_TIMEOUT_MS)
}
