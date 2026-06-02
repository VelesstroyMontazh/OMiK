import { NextResponse } from 'next/server'
import { ensureExcelBackendServer } from '@/lib/ensure-excel-backend'
import { proxyBackend } from '@/lib/backend-proxy'

export const runtime = 'nodejs'
export const maxDuration = 120

/** Автозапуск excel-service (без ручного START.bat в типичном сценарии). */
export async function GET() {
  const result = await ensureExcelBackendServer(90_000)
  if (result.status === 'ok') {
    return proxyBackend('/api/health', undefined, 15_000)
  }
  if (result.status === 'busy') {
    return NextResponse.json(
      { status: 'busy', detail: result.detail },
      { status: 503 },
    )
  }
  return NextResponse.json(
    { status: 'down', detail: result.detail },
    { status: 503 },
  )
}
