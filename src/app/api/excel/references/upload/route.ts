import { NextRequest, NextResponse } from 'next/server'
import { proxyBackend } from '@/lib/backend-proxy'

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const kind = searchParams.get('kind')
  if (!kind || !['territory', 'podr', 'login'].includes(kind)) {
    return NextResponse.json({ error: 'kind required: territory | podr | login' }, { status: 400 })
  }
  const form = await request.formData()
  const file = form.get('file')
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'file required' }, { status: 400 })
  }
  const buf = Buffer.from(await file.arrayBuffer())
  const name = file instanceof File ? file.name : 'upload.xlsx'
  const body = new FormData()
  body.append('file', new Blob([buf]), name)
  return proxyBackend(`/api/references/upload/${kind}`, {
    method: 'POST',
    body,
  }, 120_000)
}
