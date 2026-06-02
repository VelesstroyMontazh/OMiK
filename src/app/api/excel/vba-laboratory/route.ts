import { NextRequest, NextResponse } from 'next/server'
import { proxyBackend } from '@/lib/backend-proxy'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') || 'list'
  const filePath = searchParams.get('file_path')

  if (action === 'detect' && filePath) {
    return proxyBackend(
      `/api/vba-laboratory/detect?file_path=${encodeURIComponent(filePath)}`,
      undefined,
      60_000,
    )
  }

  return proxyBackend('/api/vba-laboratory/macros', undefined, 30_000)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  return proxyBackend('/api/vba-laboratory/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const macroId = body.macro_id as string
  if (!macroId) {
    return NextResponse.json({ detail: 'macro_id required' }, { status: 400 })
  }
  return proxyBackend(`/api/vba-laboratory/macros/${encodeURIComponent(macroId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: body.name,
      code: body.code,
      language: body.language,
    }),
  })
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const macroId = searchParams.get('macro_id')
  if (!macroId) {
    return NextResponse.json({ detail: 'macro_id required' }, { status: 400 })
  }
  return proxyBackend(`/api/vba-laboratory/macros/${encodeURIComponent(macroId)}`, {
    method: 'DELETE',
  })
}
