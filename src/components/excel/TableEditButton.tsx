'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FileSpreadsheet, Loader2 } from 'lucide-react'
import { openFileInSpreadsheetEditor, openTableInSpreadsheetEditor, type SpreadsheetColumn } from '@/lib/openSpreadsheetEditor'
import { useExcelApi } from '@/hooks/use-excel-api'

export default function TableEditButton({
  title,
  columns,
  rows,
  filePath,
  sheetName,
  disabled,
  className,
}: {
  title: string
  columns: SpreadsheetColumn[]
  rows: Record<string, unknown>[]
  /** Если указан — открыть исходный .xlsx с диска */
  filePath?: string | null
  sheetName?: string
  disabled?: boolean
  className?: string
}) {
  const api = useExcelApi()
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    if (disabled || loading) return
    setLoading(true)
    try {
      if (filePath?.trim()) {
        const path = filePath.trim()
        await openFileInSpreadsheetEditor(
          (p, sheet) => api.fetchSheetData(p, sheet ?? 'Лист1'),
          path,
          title,
          sheetName,
        )
      } else {
        openTableInSpreadsheetEditor({ title, columns, rows })
      }
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'Не удалось открыть в редакторе')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={`h-8 text-[11px] ${className || ''}`}
      disabled={disabled || loading || (!filePath && (!columns.length || !rows.length))}
      onClick={() => void handleClick()}
      title="Открыть в редакторе Excel (как новая книга)"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
      ) : (
        <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
      )}
      Редактировать
    </Button>
  )
}
