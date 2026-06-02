'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'
import { exportTableToExcel } from '@/lib/export-table-to-excel'
import type { SpreadsheetColumn } from '@/lib/openSpreadsheetEditor'

export default function ExportToExcelButton({
  fileName,
  columns,
  rows,
  disabled,
  className,
  label = 'Экспорт в Excel',
  serverExport,
  serverExportTitle,
}: {
  fileName: string
  columns: SpreadsheetColumn[]
  rows: Record<string, unknown>[]
  disabled?: boolean
  className?: string
  label?: string
  /** Серверная выгрузка (без лимита строк в браузере). */
  serverExport?: () => Promise<void>
  serverExportTitle?: string
}) {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    if (disabled || loading) return
    setLoading(true)
    try {
      if (serverExport) {
        await serverExport()
      } else {
        await exportTableToExcel(columns, rows, fileName)
      }
    } catch (e) {
      console.error(e)
      window.alert(e instanceof Error ? e.message : 'Не удалось выгрузить в Excel')
    } finally {
      setLoading(false)
    }
  }

  const canExport = serverExport
    ? !disabled && columns.length
    : !disabled && columns.length && rows.length

  const title = serverExport
    ? (serverExportTitle || 'Сформировать Excel на сервере и скачать (.xlsx)')
    : 'Скачать текущую таблицу в Microsoft Excel (.xlsx)'

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={`h-8 text-[11px] ${className || ''}`}
      disabled={!canExport || loading}
      onClick={() => void handleExport()}
      title={title}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5 mr-1" />
      )}
      {label}
    </Button>
  )
}
