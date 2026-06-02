import { NextRequest, NextResponse } from 'next/server'
import { proxyBackend } from '@/lib/backend-proxy'

export const maxDuration = 3600
export const runtime = 'nodejs'

const PROCESS_TIMEOUT_MS = 30 * 60 * 1000

export async function POST(request: NextRequest) {
  const body = await request.json()
  if (body.action !== 'process') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  return proxyBackend(
    '/api/file-prepare/process',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_path: body.file_path,
        output_name: body.output_name,
        save_in_place: Boolean(body.save_in_place),
      }),
    },
    PROCESS_TIMEOUT_MS,
  )
}
