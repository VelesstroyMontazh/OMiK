import { useExcelStore } from '@/store/excel-store'

export type SpreadsheetColumn = { key: string; title: string }

function cellToString(v: unknown): string {
  if (v == null) return ''
  return String(v)
}

/** Открыть данные таблицы в редакторе (как «Новая книга»), без сохранения на диск. */
export function openTableInSpreadsheetEditor(params: {
  title: string
  columns: SpreadsheetColumn[]
  rows: Record<string, unknown>[]
  sheetName?: string
}): void {
  const { title, columns, rows, sheetName = 'Лист1' } = params
  if (!columns.length) return

  const sheetData: string[][] = [
    columns.map((c) => c.title),
    ...rows.map((row) => columns.map((c) => cellToString(row[c.key]))),
  ]

  useExcelStore.getState().pushNavHistory()
  useExcelStore.setState({
    activeFile: {
      id: `table-${Date.now()}`,
      name: title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      size: 0,
    },
    currentFilePath: null,
    sheets: [
      {
        name: sheetName,
        data: {},
        mergedCells: [],
        columnWidths: {},
        rowHeights: {},
        defaultColumnWidth: 100,
        defaultRowHeight: 24,
      },
    ],
    activeSheetIndex: 0,
    selectedCell: { row: 0, col: 0 },
    selectedRange: null,
  })
  useExcelStore.getState().loadSheetData(sheetData)
}

/** Открыть файл Excel с диска в редакторе (как при загрузке с диска). */
export async function openFileInSpreadsheetEditor(
  fetchSheetData: (_filePath: string, _sheetName?: string) => Promise<{ data: unknown }>,
  filePath: string,
  displayName: string,
  sheetName?: string,
): Promise<void> {
  const result = await fetchSheetData(filePath, sheetName)
  const store = useExcelStore.getState()

  useExcelStore.getState().pushNavHistory()
  useExcelStore.setState({
    activeFile: {
      id: `file-${Date.now()}`,
      name: displayName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      size: 0,
      filePath,
      sheets: sheetName ? [sheetName] : ['Лист1'],
    },
    currentFilePath: filePath,
    sheets: [
      {
        name: sheetName || 'Лист1',
        data: {},
        mergedCells: [],
        columnWidths: {},
        rowHeights: {},
        defaultColumnWidth: 100,
        defaultRowHeight: 24,
      },
    ],
    activeSheetIndex: 0,
    selectedCell: { row: 0, col: 0 },
    selectedRange: null,
  })
  store.loadApiSheetData(
    result.data as Array<Array<{ row: number; col: number; value: unknown; type: string }>>,
  )
}
