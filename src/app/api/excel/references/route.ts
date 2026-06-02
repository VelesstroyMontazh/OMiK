import { NextRequest, NextResponse } from 'next/server'
import { proxyBackend } from '@/lib/backend-proxy'
import { ensureExcelBackendServer } from '@/lib/ensure-excel-backend'

const TIMEOUT_MS = 120_000

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') || 'status'
  if (action === 'status') {
    const ensured = await ensureExcelBackendServer(60_000)
    if (ensured.status !== 'ok') {
      return NextResponse.json(
        { error: ensured.detail || 'Excel-backend недоступен. Запустите RESTART-EXCEL.bat' },
        { status: 503 },
      )
    }
    const proxied = await proxyBackend('/api/references/status', undefined, TIMEOUT_MS)
    if (proxied.status === 404) {
      return NextResponse.json(
        {
          error:
            'Маршрут справочников не найден на excel-backend. Перезапустите RESTART-EXCEL.bat после обновления кода.',
        },
        { status: 503 },
      )
    }
    return proxied
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') || 'load'
  const ensured = await ensureExcelBackendServer(90_000)
  if (ensured.status !== 'ok') {
    return NextResponse.json(
      { error: ensured.detail || 'Excel-backend недоступен' },
      { status: 503 },
    )
  }
  switch (action) {
    case 'load':
      return proxyBackend('/api/references/load', { method: 'POST' }, TIMEOUT_MS)
    case 'apply':
      return proxyBackend('/api/references/apply', { method: 'POST' }, 600_000)
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}
