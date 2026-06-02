import { NextRequest } from 'next/server'
import { proxyBackend } from '@/lib/backend-proxy'

export async function POST(request: NextRequest) {
  const body = await request.text()
  return proxyBackend('/api/sheet-update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
}
