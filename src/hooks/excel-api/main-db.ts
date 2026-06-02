import { proxyJson } from '@/hooks/excel-api/http'

export function createMainDbApi() {
  const mainDbStatus = async () =>
    proxyJson('/api/excel/main-db?action=status', { method: 'GET' })

  const mainDbLoad = async (
    filePath: string,
    options?: { forceReload?: boolean; sheetName?: string; setActive?: boolean },
  ) => {
    if (!filePath?.trim()) {
      throw new Error('Укажите путь к файлу Excel')
    }
    return proxyJson('/api/excel/main-db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'load',
        file_path: filePath.trim(),
        sheet_name: options?.sheetName,
        force_reload: Boolean(options?.forceReload),
        set_active: Boolean(options?.setActive),
      }),
    }, 600_000)
  }

  const mainDbData = async (
    params: {
      offset?: number
      limit?: number
      search?: string
      filters?: Record<string, string>
      sort_column?: string
      sort_ascending?: boolean
      key_columns_only?: boolean
    } = {},
  ) => {
    const sp = new URLSearchParams({ action: 'data' })
    if (params.offset !== undefined) sp.set('offset', String(params.offset))
    if (params.limit !== undefined) sp.set('limit', String(params.limit))
    if (params.search) sp.set('search', params.search)
    if (params.sort_column) sp.set('sort_column', params.sort_column)
    if (params.sort_ascending !== undefined) sp.set('sort_ascending', String(params.sort_ascending))
    if (params.key_columns_only !== undefined) sp.set('key_columns_only', String(params.key_columns_only))
    if (params.filters && Object.keys(params.filters).length > 0) {
      sp.set('filters', JSON.stringify(params.filters))
    }
    return proxyJson(`/api/excel/main-db?${sp.toString()}`, { method: 'GET' })
  }

  const mainDbColumns = async () =>
    proxyJson('/api/excel/main-db?action=columns', { method: 'GET' })

  const mainDbStats = async () =>
    proxyJson('/api/excel/main-db?action=stats', { method: 'GET' })

  const mainDbSearch = async (params: {
    query: string
    key_columns_only?: boolean
    exact_match?: boolean
    offset?: number
    limit?: number
  }) =>
    proxyJson('/api/excel/main-db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'search', ...params }),
    })

  const mainDbClear = async () =>
    proxyJson('/api/excel/main-db', { method: 'DELETE' })

  const mainDbInstances = async () =>
    proxyJson('/api/excel/main-db?action=instances', { method: 'GET' })

  const mainDbActivate = async (instanceId: string) =>
    proxyJson('/api/excel/main-db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'activate', instance_id: instanceId }),
    })

  const mainDbDeleteInstance = async (instanceId: string) =>
    proxyJson(`/api/excel/main-db?instance_id=${encodeURIComponent(instanceId)}`, {
      method: 'DELETE',
    })

  const mainDbVerifyInstance = async (instanceId: string) =>
    proxyJson(
      `/api/excel/main-db/instances/${encodeURIComponent(instanceId)}/verify`,
      { method: 'GET' },
    )

  const mainDbExportInstanceUrl = (instanceId: string) =>
    `/api/excel/main-db/instances/${encodeURIComponent(instanceId)}/export`

  return {
    mainDbStatus,
    mainDbLoad,
    mainDbData,
    mainDbColumns,
    mainDbStats,
    mainDbSearch,
    mainDbClear,
    mainDbInstances,
    mainDbActivate,
    mainDbDeleteInstance,
    mainDbVerifyInstance,
    mainDbExportInstanceUrl,
  }
}
