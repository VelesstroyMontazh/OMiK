import { NextRequest, NextResponse } from 'next/server'
import { proxyBackend } from '@/lib/backend-proxy'

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userRole = searchParams.get('user_role')
  if (!userRole) {
    return NextResponse.json({ error: 'user_role required' }, { status: 400 })
  }
  const body = await request.json()
  const params = new URLSearchParams({ user_role: userRole })
  return proxyBackend(`/api/daily-tracking/sites/custom?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
