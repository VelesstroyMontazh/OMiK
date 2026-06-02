'use client'

import React, { useMemo } from 'react'
import ColumnHeaderFilter from '@/components/excel/ColumnHeaderFilter'
import TableEditButton from '@/components/excel/TableEditButton'
import ExportToExcelButton from '@/components/excel/ExportToExcelButton'
import DailyTableScrollBox from '@/components/excel/DailyTableScrollBox'
import { cellText, useColumnFilters } from '@/hooks/useColumnFilters'
import type { SpreadsheetColumn } from '@/lib/openSpreadsheetEditor'

export type FilterableColumn = SpreadsheetColumn

export default function FilterableDataTable({
  title,
  columns,
  rows,
  editTitle,
  exportFileName,
  filePath,
  sheetName,
  maxHeight = 'max-h-64',
  footerExtra,
  showRowNumbers = true,
  headerVariant = 'gray',
  className = '',
  emptyMessage = 'Нет данных',
  serverExport,
  serverExportTitle,
  wideTable = false,
}: {
  title?: string
  columns: FilterableColumn[]
  rows: Record<string, unknown>[]
  editTitle?: string
  exportFileName?: string
  filePath?: string | null
  sheetName?: string
  maxHeight?: string
  showRowNumbers?: boolean
  headerVariant?: 'indigo' | 'gray' | 'amber'
  className?: string
  emptyMessage?: string
  footerExtra?: React.ReactNode
  serverExport?: () => Promise<void>
  serverExportTitle?: string
  wideTable?: boolean
}) {
  const columnKeys = useMemo(() => columns.map((c) => c.key), [columns])
  const {
    openFilterCol,
    setOpenFilterCol,
    uniqueByColumn,
    filteredRows,
    columnFilters,
    toggleFilterValue,
    clearColFilter,
    selectAllFilterValues,
    selectNoneFilterValues,
  } = useColumnFilters(rows, columnKeys)

  const headerBg =
    headerVariant === 'indigo'
      ? 'bg-indigo-50 text-indigo-900'
      : headerVariant === 'amber'
        ? 'bg-amber-50 text-amber-800'
        : 'bg-gray-100 text-gray-700'

  const isFlexHeight = maxHeight.includes('flex-1') || maxHeight.includes('min-h-')
  const scrollWrapClass = isFlexHeight
    ? `flex-1 min-h-0 min-w-0 w-full flex flex-col ${maxHeight}`
    : `min-w-0 w-full flex flex-col ${maxHeight}`

  const tableEl = (
    <table
      className={
        wideTable
          ? 'text-[11px] border-collapse'
          : 'w-full text-[11px] border-collapse min-w-max'
      }
      style={wideTable ? { width: 'max-content', minWidth: '100%' } : undefined}
    >
      <thead className={`sticky top-0 z-20 ${headerBg}`}>
        <tr>
          {showRowNumbers && (
            <th
              className={`px-1 py-1 border-b border-r font-medium ${headerBg}`}
              style={wideTable ? { minWidth: 44 } : { width: 32 }}
            >
              №
            </th>
          )}
          {columns.map((col) => (
            <th
              key={col.key}
              className={
                wideTable
                  ? `px-2 py-1 border-b border-r text-left font-semibold whitespace-nowrap relative ${headerBg}`
                  : `px-1 py-1 border-b border-r text-left font-semibold whitespace-nowrap relative ${headerBg}`
              }
              style={wideTable ? { minWidth: 100 } : undefined}
            >
              <ColumnHeaderFilter
                colKey={col.key}
                title={col.title}
                activeFilter={Boolean(columnFilters[col.key]?.size)}
                isOpen={openFilterCol === col.key}
                uniqueValues={uniqueByColumn[col.key] || []}
                selected={columnFilters[col.key]}
                onToggleOpen={setOpenFilterCol}
                onToggleValue={toggleFilterValue}
                onClear={clearColFilter}
                onSelectAll={selectAllFilterValues}
                onSelectNone={selectNoneFilterValues}
                variant={headerVariant}
              />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filteredRows.map((row, i) => (
          <tr key={i} className={i % 2 ? 'bg-gray-50' : 'bg-white'}>
            {showRowNumbers && (
              <td className="px-1 py-0.5 border-b border-r text-right text-gray-400 whitespace-nowrap">
                {i + 1}
              </td>
            )}
            {columns.map((col) => (
              <td
                key={col.key}
                className={
                  wideTable
                    ? 'border-b border-r px-2 py-0.5 whitespace-nowrap'
                    : 'border-b border-r px-1 py-0.5 max-w-[200px] truncate'
                }
                style={wideTable ? { minWidth: 100 } : undefined}
                title={cellText(row[col.key])}
              >
                {cellText(row[col.key])}
              </td>
            ))}
          </tr>
        ))}
        {!filteredRows.length && (
          <tr>
            <td
              colSpan={columns.length + (showRowNumbers ? 1 : 0)}
              className="text-center py-6 text-gray-400"
            >
              {emptyMessage}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )

  return (
    <div className={`flex flex-col min-w-0 max-w-full h-full ${className}`}>
      {(title || editTitle) && (
        <div className="flex flex-wrap items-center gap-2 px-2 py-1.5 border-b bg-gray-50/80 shrink-0">
          {title && <span className="text-[11px] font-semibold text-gray-800">{title}</span>}
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <ExportToExcelButton
              fileName={exportFileName || editTitle || title || 'Таблица'}
              columns={columns}
              rows={filteredRows}
              serverExport={serverExport}
              serverExportTitle={serverExportTitle}
              label={serverExport ? 'Выгрузка по шаблону' : 'Экспорт в Excel'}
            />
            <TableEditButton
              title={editTitle || title || 'Таблица'}
              columns={columns}
              rows={filteredRows}
              filePath={filePath}
              sheetName={sheetName}
            />
          </div>
        </div>
      )}

      {wideTable ? (
        <DailyTableScrollBox className={scrollWrapClass}>{tableEl}</DailyTableScrollBox>
      ) : (
        <div className={`overflow-auto ${scrollWrapClass}`}>{tableEl}</div>
      )}

      <div className="text-[10px] text-gray-500 px-2 py-1 border-t shrink-0 bg-gray-50">
        Показано {filteredRows.length.toLocaleString('ru-RU')} из {rows.length.toLocaleString('ru-RU')}

        {footerExtra}
      </div>
    </div>
  )
}
