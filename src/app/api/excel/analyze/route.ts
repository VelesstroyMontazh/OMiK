import { NextRequest, NextResponse } from 'next/server'
import { proxyBackend } from '@/lib/backend-proxy'

const DEFAULT_OPERATIONS = ['sum', 'avg', 'count', 'min', 'max', 'std', 'median']

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    file_path?: string
    sheet_name?: string
    range?: string
    operations?: string[]
  }

  if (!body.file_path || !body.sheet_name) {
    return NextResponse.json(
      { error: 'Missing required fields: file_path, sheet_name' },
      { status: 400 },
    )
  }

  return proxyBackend('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file_path: body.file_path,
      sheet_name: body.sheet_name,
      range: body.range || null,
      operations: body.operations || DEFAULT_OPERATIONS,
    }),
  })
}
