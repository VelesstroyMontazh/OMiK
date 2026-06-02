import { NextRequest, NextResponse } from 'next/server'
import { proxyBackend } from '@/lib/backend-proxy'

const STATUS_TIMEOUT_MS = 30_000
const DATA_TIMEOUT_MS = 600_000

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') || 'status'

  switch (action) {
    case 'status':
      return proxyBackend('/api/calendar/status', undefined, STATUS_TIMEOUT_MS)
    case 'data': {
      const params = new URLSearchParams()
      const direction = searchParams.get('direction')
      const year = searchParams.get('year')
      const month = searchParams.get('month')
      const citizenship = searchParams.get('citizenship')
      const justification = searchParams.get('justification')
      const justificationContains = searchParams.get('justification_contains')
      const arrivalStatus = searchParams.get('arrival_status')
      const workerType = searchParams.get('worker_type')
      const department = searchParams.get('department')
      const dateFrom = searchParams.get('date_from')
      const dateTo = searchParams.get('date_to')
      const search = searchParams.get('search')
      const offset = searchParams.get('offset') || '0'
      const limit = searchParams.get('limit') || '200'

      if (direction) params.set('direction', direction)
      if (year) params.set('year', year)
      if (month) params.set('month', month)
      if (citizenship) params.set('citizenship', citizenship)
      if (justification) params.set('justification', justification)
      if (justificationContains) params.set('justification_contains', justificationContains)
      if (arrivalStatus) params.set('arrival_status', arrivalStatus)
      if (workerType) params.set('worker_type', workerType)
      if (department) params.set('department', department)
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)
      if (search) params.set('search', search)
      params.set('offset', offset)
      params.set('limit', limit)

      return proxyBackend(`/api/calendar/data?${params.toString()}`, undefined, DATA_TIMEOUT_MS)
    }
    case 'stats': {
      const params = new URLSearchParams()
      const direction = searchParams.get('direction')
      const year = searchParams.get('year')
      const month = searchParams.get('month')
      if (direction) params.set('direction', direction)
      if (year) params.set('year', year)
      if (month) params.set('month', month)

      const qs = params.toString()
      return proxyBackend(`/api/calendar/stats${qs ? `?${qs}` : ''}`, undefined, DATA_TIMEOUT_MS)
    }
    case 'unique-values': {
      const column = searchParams.get('column')
      if (!column) {
        return NextResponse.json({ error: 'column parameter required' }, { status: 400 })
      }
      return proxyBackend(
        `/api/calendar/unique-values?column=${encodeURIComponent(column)}`,
        undefined,
        DATA_TIMEOUT_MS,
      )
    }
    case 'merged-status':
      return proxyBackend('/api/calendar/merged/status', undefined, STATUS_TIMEOUT_MS)
    case 'merged-data': {
      const params = new URLSearchParams()
      const direction = searchParams.get('direction')
      const year = searchParams.get('year')
      const month = searchParams.get('month')
      const search = searchParams.get('search')
      const offset = searchParams.get('offset') || '0'
      const limit = searchParams.get('limit') || '200'
      if (direction) params.set('direction', direction)
      if (year) params.set('year', year)
      if (month) params.set('month', month)
      if (search) params.set('search', search)
      params.set('offset', offset)
      params.set('limit', limit)
      return proxyBackend(`/api/calendar/merged/data?${params.toString()}`, undefined, DATA_TIMEOUT_MS)
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const action = body.action || 'load'

  switch (action) {
    case 'load':
      return proxyBackend(
        '/api/calendar/load',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_path: body.file_path }),
        },
        DATA_TIMEOUT_MS,
      )
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}

export async function DELETE() {
  return proxyBackend('/api/calendar/clear', { method: 'DELETE' }, STATUS_TIMEOUT_MS)
}
