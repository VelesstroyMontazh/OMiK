import { apiUrl } from '@/hooks/excel-api/http'

export function createDataOpsApi() {
  const sortData = async (
    filePath: string,
    sheetName: string,
    column: string,
    ascending: boolean,
    range?: string,
  ) => {
    const response = await fetch(apiUrl('/data-ops'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sort',
        file_path: filePath,
        sheet_name: sheetName,
        column,
        ascending,
        range,
      }),
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Ошибка сортировки' }))
      throw new Error(error.detail || 'Ошибка сортировки')
    }
    return response.json()
  }

  const filterData = async (
    filePath: string,
    sheetName: string,
    column: string,
    condition: string,
    value?: unknown,
    range?: string,
  ) => {
    const response = await fetch(apiUrl('/data-ops'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'filter',
        file_path: filePath,
        sheet_name: sheetName,
        column,
        condition,
        value,
        range,
      }),
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Ошибка фильтрации' }))
      throw new Error(error.detail || 'Ошибка фильтрации')
    }
    return response.json()
  }

  const findReplace = async (
    filePath: string,
    sheetName: string,
    find: string,
    replace: string,
    range?: string,
  ) => {
    const response = await fetch(apiUrl('/data-ops'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'find-replace',
        file_path: filePath,
        sheet_name: sheetName,
        find,
        replace,
        range,
      }),
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Ошибка поиска и замены' }))
      throw new Error(error.detail || 'Ошибка поиска и замены')
    }
    return response.json()
  }

  const mergeCells = async (
    filePath: string,
    sheetName: string,
    range: string,
    action: 'merge' | 'unmerge' = 'merge',
  ) => {
    const response = await fetch(apiUrl('/data-ops'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'merge',
        file_path: filePath,
        sheet_name: sheetName,
        range,
        action_merge: action,
      }),
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Ошибка объединения ячеек' }))
      throw new Error(error.detail || 'Ошибка объединения ячеек')
    }
    return response.json()
  }

  const formatCells = async (
    filePath: string,
    sheetName: string,
    range: string,
    formatType: string,
    formatValue?: unknown,
  ) => {
    const response = await fetch(apiUrl('/data-ops'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'format',
        file_path: filePath,
        sheet_name: sheetName,
        range,
        format_type: formatType,
        format_value: formatValue,
      }),
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Ошибка форматирования' }))
      throw new Error(error.detail || 'Ошибка форматирования')
    }
    return response.json()
  }

  return { sortData, filterData, findReplace, mergeCells, formatCells }
}
