import { proxyJson } from '@/hooks/excel-api/http'

export function createMergeApi() {
  const scanMergeFolder = async (folderPath: string) =>
    proxyJson('/api/excel/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'scan-folder', folder_path: folderPath }),
    })

  const executeMerge = async (params: {
    mode: 'headers_equal' | 'headers_equal_select' | 'headers_not_equal'
    items: Array<{ file_path: string; sheet_name: string; header_row: number; include?: boolean }>
    selected_headers?: string[]
    target_headers?: string[]
    mappings?: Record<string, Record<string, string>>
    output_name?: string
  }) =>
    proxyJson('/api/excel/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'execute', ...params }),
    })

  return { scanMergeFolder, executeMerge }
}
