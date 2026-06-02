import { NextRequest, NextResponse } from 'next/server'
import { proxyBackend } from '@/lib/backend-proxy'

export async function GET() {
  return proxyBackend('/api/settings/welcome-modules')
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  return proxyBackend('/api/settings/welcome-modules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
