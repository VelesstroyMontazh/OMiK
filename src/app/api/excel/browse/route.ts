import { NextRequest } from 'next/server'
import { proxyBackend } from '@/lib/backend-proxy'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('mode') || 'file'
  const initialDir = searchParams.get('initial_dir')
  const params = new URLSearchParams()
  if (initialDir) params.set('initial_dir', initialDir)
  const qs = params.toString() ? `?${params.toString()}` : ''

  if (mode === 'folder') {
    return proxyBackend(`/api/browse/folder${qs}`, undefined, 120_000)
  }
  return proxyBackend(`/api/browse/file${qs}`, undefined, 120_000)
}
