import { NextRequest, NextResponse } from 'next/server'
import { proxyBackend } from '@/lib/backend-proxy'

const LOAD_TIMEOUT_MS = 600_000

// GET /api/excel/main-db - Proxy to Python backend main-db endpoints
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') || 'status'

  switch (action) {
    case 'status':
      return proxyBackend('/api/main-db/status')
    case 'data': {
      const offset = searchParams.get('offset') || '0'
      const limit = searchParams.get('limit') || '100'
      const search = searchParams.get('search') || ''
      const sortColumn = searchParams.get('sort_column') || ''
      const sortAscending = searchParams.get('sort_ascending') || 'true'
      const keyColumnsOnly = searchParams.get('key_columns_only') || 'false'
      const filtersStr = searchParams.get('filters') || ''

      let queryParams = `offset=${offset}&limit=${limit}`
      if (search) queryParams += `&search=${encodeURIComponent(search)}`
      if (sortColumn) queryParams += `&sort_column=${encodeURIComponent(sortColumn)}`
      queryParams += `&sort_ascending=${sortAscending}`
      queryParams += `&key_columns_only=${keyColumnsOnly}`
      if (filtersStr) queryParams += `&filters=${encodeURIComponent(filtersStr)}`

      return proxyBackend(`/api/main-db/data?${queryParams}`)
    }
    case 'columns':
      return proxyBackend('/api/main-db/columns')
    case 'stats':
      return proxyBackend('/api/main-db/stats')
    case 'instances':
      return proxyBackend('/api/main-db/instances')
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}

// POST /api/excel/main-db - Load or search main database
export async function POST(request: NextRequest) {
  const body = await request.json()
  const action = body.action || 'load'

  switch (action) {
    case 'load':
      return proxyBackend('/api/main-db/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_path: body.file_path,
          sheet_name: body.sheet_name,
          force_reload: Boolean(body.force_reload),
          set_active: Boolean(body.set_active),
        }),
      }, LOAD_TIMEOUT_MS)
    case 'activate':
      return proxyBackend('/api/main-db/instances/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instance_id: body.instance_id }),
      })
    case 'search':
      return proxyBackend('/api/main-db/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: body.query,
          columns: body.columns,
          key_columns_only: body.key_columns_only || false,
          exact_match: body.exact_match || false,
          case_sensitive: body.case_sensitive || false,
          offset: body.offset || 0,
          limit: body.limit || 100,
        }),
      })
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}

// DELETE /api/excel/main-db — clear cache or delete instance (?instance_id=)
export async function DELETE(request: NextRequest) {
  const instanceId = new URL(request.url).searchParams.get('instance_id')
  if (instanceId) {
    return proxyBackend(`/api/main-db/instances/${encodeURIComponent(instanceId)}`, {
      method: 'DELETE',
    })
  }
  return proxyBackend('/api/main-db/clear', { method: 'DELETE' })
}
