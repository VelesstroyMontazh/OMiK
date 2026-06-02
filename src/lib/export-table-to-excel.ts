import type { SpreadsheetColumn } from '@/lib/openSpreadsheetEditor'

function cellExportValue(v: unknown): string | number | boolean {
  if (v == null) return ''
  if (typeof v === 'number' || typeof v === 'boolean') return v
  return String(v)
}

function sanitizeFileName(name: string): string {
  const base = name.replace(/[<>:"/\\|?*]+/g, '_').trim() || 'export'
  const noExt = base.replace(/\.(xlsx|xls)$/i, '')
  return `${noExt}.xlsx`
}

const MAX_CLIENT_EXPORT_ROWS = 25_000

/** Скачать таблицу в настоящий .xlsx (библиотека SheetJS). */
export async function exportTableToExcel(
  columns: SpreadsheetColumn[],
  rows: Record<string, unknown>[],
  fileName: string,
): Promise<void> {
  if (!columns.length) {
    throw new Error('Нет столбцов для экспорта')
  }
  if (!rows.length) {
    throw new Error('Нет строк для экспорта')
  }
  if (rows.length > MAX_CLIENT_EXPORT_ROWS) {
    throw new Error(
      `Слишком много строк (${rows.length.toLocaleString('ru-RU')}) для выгрузки в браузере. `
      + `Сузьте фильтры, загрузите меньше данных или используйте серверный экспорт (до ${MAX_CLIENT_EXPORT_ROWS.toLocaleString('ru-RU')} строк в этом режиме).`,
    )
  }

  const XLSX = await import('xlsx')
  const header = columns.map((c) => c.title)
  const body = rows.map((row) => columns.map((c) => cellExportValue(row[c.key])))
  const sheet = XLSX.utils.aoa_to_sheet([header, ...body])
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Данные')
  XLSX.writeFile(book, sanitizeFileName(fileName))
}
