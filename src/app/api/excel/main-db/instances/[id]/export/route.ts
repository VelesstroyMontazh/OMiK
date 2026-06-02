import { NextRequest } from 'next/server'
import { proxyBackend } from '@/lib/backend-proxy'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return proxyBackend(`/api/main-db/instances/${encodeURIComponent(id)}/export`)
}
