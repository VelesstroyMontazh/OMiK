import { NextRequest, NextResponse } from 'next/server'
import { proxyBackend } from '@/lib/backend-proxy'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const action = body.action as string

  switch (action) {
    case 'scan-folder':
      return proxyBackend('/api/merge/scan-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_path: body.folder_path }),
      })
    case 'execute':
      return proxyBackend('/api/merge/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: body.mode,
          items: body.items,
          selected_headers: body.selected_headers,
          target_headers: body.target_headers,
          mappings: body.mappings,
          output_name: body.output_name,
        }),
      })
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}