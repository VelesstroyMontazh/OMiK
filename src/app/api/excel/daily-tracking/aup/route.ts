import { NextRequest } from 'next/server'
import { proxyBackend } from '@/lib/backend-proxy'

const TIMEOUT_MS = 300_000

export async function GET() {
  return proxyBackend('/api/daily-tracking/aup', undefined, TIMEOUT_MS)
}

export async function POST(request: NextRequest) {
  const form = await request.formData()
  const file = form.get('file')
  if (!file || !(file instanceof Blob)) {
    return Response.json({ error: 'file required' }, { status: 400 })
  }
  const buf = Buffer.from(await file.arrayBuffer())
  const name = file instanceof File ? file.name : 'АУП_РОП_ИТР.xlsx'
  const body = new FormData()
  body.append('file', new Blob([buf]), name)
  return proxyBackend('/api/daily-tracking/aup', { method: 'POST', body }, TIMEOUT_MS)
}
