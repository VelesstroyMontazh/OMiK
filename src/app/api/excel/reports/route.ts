import { NextRequest, NextResponse } from 'next/server'
import { proxyBackend } from '@/lib/backend-proxy'

const FILTERS_TIMEOUT_MS = 60_000
const GENERATE_TIMEOUT_MS = 600_000

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') || 'filters'

  switch (action) {
    case 'filters':
      return proxyBackend('/api/reports/filters', undefined, FILTERS_TIMEOUT_MS)
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const action = body.action || 'generate'

  switch (action) {
    case 'generate': {
      const reportParams = { ...body } as Record<string, unknown>
      delete reportParams.action
      return proxyBackend(
        '/api/reports/generate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reportParams),
        },
        GENERATE_TIMEOUT_MS,
      )
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}
