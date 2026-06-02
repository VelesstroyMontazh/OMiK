import { NextRequest, NextResponse } from 'next/server'
import { proxyBackend } from '@/lib/backend-proxy'
import { db } from '@/lib/db'

type DataAction =
  | 'sort'
  | 'filter'
  | 'find-replace'
  | 'pivot'
  | 'merge'
  | 'format'
  | 'insert'
  | 'delete'

interface DataOpsBody {
  action: DataAction
  file_path: string
  sheet_name: string
  // Sort params
  column?: string
  ascending?: boolean
  range?: string
  // Filter params
  condition?: string
  value?: unknown
  // Find-replace params
  find?: string
  replace?: string
  // Pivot params
  rows?: string[]
  columns?: string[]
  values?: string[]
  agg_func?: string
  // Merge params
  action_merge?: string // 'merge' | 'unmerge'
  // Format params
  format_type?: string
  format_value?: unknown
  // Insert/Delete params
  position?: number
  count?: number
  direction?: string // 'rows' | 'cols'
}

const VALID_ACTIONS: Set<string> = new Set([
  'sort',
  'filter',
  'find-replace',
  'pivot',
  'merge',
  'format',
  'insert',
  'delete',
])

/** Map of action -> Python backend endpoint */
const ACTION_ENDPOINTS: Record<string, string> = {
  sort: '/api/sort',
  filter: '/api/filter',
  'find-replace': '/api/find-replace',
  pivot: '/api/pivot',
  merge: '/api/merge-cells',
  format: '/api/format-cells',
  insert: '/api/insert-rows-cols',
  delete: '/api/delete-rows-cols',
}

function buildBackendBody(action: DataAction, body: DataOpsBody): Record<string, unknown> {
  switch (action) {
    case 'sort':
      return {
        file_path: body.file_path,
        sheet_name: body.sheet_name,
        column: body.column,
        ascending: body.ascending ?? true,
        range: body.range,
      }

    case 'filter':
      return {
        file_path: body.file_path,
        sheet_name: body.sheet_name,
        column: body.column,
        condition: body.condition,
        value: body.value,
        range: body.range,
      }

    case 'find-replace':
      return {
        file_path: body.file_path,
        sheet_name: body.sheet_name,
        find: body.find,
        replace: body.replace,
        range: body.range,
      }

    case 'pivot':
      return {
        file_path: body.file_path,
        sheet_name: body.sheet_name,
        rows: body.rows,
        columns: body.columns,
        values: body.values,
        agg_func: body.agg_func || 'sum',
      }

    case 'merge':
      return {
        file_path: body.file_path,
        sheet_name: body.sheet_name,
        range: body.range,
        action: body.action_merge || 'merge',
      }

    case 'format':
      return {
        file_path: body.file_path,
        sheet_name: body.sheet_name,
        range: body.range,
        format_type: body.format_type,
        format_value: body.format_value,
      }

    case 'insert':
      return {
        file_path: body.file_path,
        sheet_name: body.sheet_name,
        position: body.position,
        count: body.count ?? 1,
        direction: body.direction || 'rows',
      }

    case 'delete':
      return {
        file_path: body.file_path,
        sheet_name: body.sheet_name,
        position: body.position,
        count: body.count ?? 1,
        direction: body.direction || 'rows',
      }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DataOpsBody
    const { action } = body

    if (!action || !VALID_ACTIONS.has(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${[...VALID_ACTIONS].join(', ')}` },
        { status: 400 }
      )
    }

    if (!body.file_path || !body.sheet_name) {
      return NextResponse.json(
        { error: 'Missing required fields: file_path, sheet_name' },
        { status: 400 }
      )
    }

    const endpoint = ACTION_ENDPOINTS[action]
    const backendBody = buildBackendBody(action, body)

    const proxyRes = await proxyBackend(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backendBody),
    })

    if (proxyRes.status < 200 || proxyRes.status >= 300) {
      return proxyRes
    }

    const data = (await proxyRes.json()) as Record<string, unknown>

    // Log the operation to the database
    try {
      // Try to find the file in the DB by path
      const dbFile = await db.excelFile.findFirst({
        where: { path: body.file_path },
      })
      if (dbFile) {
        await db.operation.create({
          data: {
            type: action,
            params: JSON.stringify(backendBody),
            status: 'completed',
            fileId: dbFile.id,
          },
        })
      }
    } catch (dbError) {
      console.error('Failed to log operation to database:', dbError)
      // Non-fatal
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Data ops error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}