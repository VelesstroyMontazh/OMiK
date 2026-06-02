import { NextRequest } from 'next/server'
import { proxyBackend } from '@/lib/backend-proxy'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await context.params
  return proxyBackend(`/api/jobs/${encodeURIComponent(jobId)}`, undefined, 30_000)
}
