import { NextRequest, NextResponse } from 'next/server'
import { proxyBackend } from '@/lib/backend-proxy'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const file_path = searchParams.get('file_path')
  const sheet_name = searchParams.get('sheet_name')

  if (!file_path || !sheet_name) {
    return NextResponse.json(
      { error: 'Missing required query parameters: file_path and sheet_name' },
      { status: 400 },
    )
  }

  const params = new URLSearchParams({ file_path, sheet_name })
  const range = searchParams.get('range')
  const max_rows = searchParams.get('max_rows')
  if (range) params.set('range', range)
  if (max_rows) params.set('max_rows', max_rows)

  return proxyBackend(`/api/sheet-data?${params.toString()}`)
}
