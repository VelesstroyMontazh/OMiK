import { NextResponse } from 'next/server'
import { pingExcelBackend, proxyBackend } from '@/lib/backend-proxy'

export const runtime = 'nodejs'
export const maxDuration = 30

/** Быстрая проверка без автоперезапуска (чтобы не DDOS-ить :3031 каждые 20 с). */
export async function GET() {
  if (await pingExcelBackend(3000)) {
    return proxyBackend('/api/health', undefined, 10_000)
  }

  if (await pingExcelBackend(15_000)) {
    return proxyBackend('/api/health', undefined, 10_000)
  }

  return NextResponse.json(
    {
      status: 'down',
      detail: 'Excel-service не отвечает. Обновление страницы запустит восстановление.',
    },
    { status: 503 },
  )
}
