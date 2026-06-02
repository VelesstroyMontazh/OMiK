import { apiUrl } from '@/hooks/excel-api/http'
import type { SheetDataResult } from '@/hooks/excel-api/types'

export function createSheetsApi() {
  const fetchSheetData = async (
    filePath: string,
    sheetName: string,
    range?: string,
  ): Promise<SheetDataResult> => {
    const params = new URLSearchParams({ file_path: filePath, sheet_name: sheetName })
    if (range) params.append('range', range)
    const response = await fetch(`${apiUrl('/sheet-data')}?${params.toString()}`, { method: 'GET' })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Ошибка загрузки данных листа' }))
      throw new Error(error.detail || 'Ошибка загрузки данных листа')
    }
    return response.json()
  }

  const updateCells = async (
    filePath: string,
    sheetName: string,
    changes: Array<{ row: number; col: number; value: string }>,
  ) => {
    const response = await fetch(apiUrl('/sheet-update'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: filePath, sheet_name: sheetName, changes }),
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Ошибка обновления ячеек' }))
      throw new Error(error.detail || 'Ошибка обновления ячеек')
    }
    return response.json()
  }

  const createSheet = async (filePath: string, sheetName: string) => {
    const response = await fetch(apiUrl('/sheet-ops'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', file_path: filePath, sheet_name: sheetName }),
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Ошибка создания листа' }))
      throw new Error(error.detail || 'Ошибка создания листа')
    }
    return response.json()
  }

  const deleteSheet = async (filePath: string, sheetName: string) => {
    const response = await fetch(apiUrl('/sheet-ops'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', file_path: filePath, sheet_name: sheetName }),
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Ошибка удаления листа' }))
      throw new Error(error.detail || 'Ошибка удаления листа')
    }
    return response.json()
  }

  const renameSheet = async (filePath: string, oldName: string, newName: string) => {
    const response = await fetch(apiUrl('/sheet-ops'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'rename',
        file_path: filePath,
        old_name: oldName,
        sheet_name: oldName,
        new_name: newName,
      }),
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Ошибка переименования листа' }))
      throw new Error(error.detail || 'Ошибка переименования листа')
    }
    return response.json()
  }

  return { fetchSheetData, updateCells, createSheet, deleteSheet, renameSheet }
}
