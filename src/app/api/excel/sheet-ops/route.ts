import { NextRequest, NextResponse } from 'next/server'
import { proxyBackend } from '@/lib/backend-proxy'

type SheetAction = 'create' | 'delete' | 'rename'

interface SheetOpsBody {
  action: SheetAction
  file_path: string
  sheet_name: string
  old_name?: string
  new_name?: string
}

const VALID_ACTIONS: Set<string> = new Set(['create', 'delete', 'rename'])

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SheetOpsBody
    const { action, file_path, sheet_name, old_name, new_name } = body

    if (!action || !VALID_ACTIONS.has(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${[...VALID_ACTIONS].join(', ')}` },
        { status: 400 },
      )
    }
    if (!file_path) {
      return NextResponse.json({ error: 'Missing required field: file_path' }, { status: 400 })
    }

    let path: string
    let payload: Record<string, unknown>
    let method: 'POST' | 'DELETE' = 'POST'

    switch (action) {
      case 'create':
        if (!sheet_name) {
          return NextResponse.json(
            { error: 'Missing required field: sheet_name for create action' },
            { status: 400 },
          )
        }
        path = '/api/sheet-create'
        payload = { file_path, sheet_name }
        break
      case 'delete':
        if (!sheet_name) {
          return NextResponse.json(
            { error: 'Missing required field: sheet_name for delete action' },
            { status: 400 },
          )
        }
        path = '/api/sheet-delete'
        payload = { file_path, sheet_name }
        method = 'DELETE'
        break
      case 'rename':
        if (!new_name) {
          return NextResponse.json(
            { error: 'Missing required field: new_name for rename action' },
            { status: 400 },
          )
        }
        path = '/api/sheet-rename'
        payload = { file_path, old_name: old_name || sheet_name, new_name }
        break
    }

    return proxyBackend(path!, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload!),
    })
  } catch (error) {
    console.error('Sheet ops error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
