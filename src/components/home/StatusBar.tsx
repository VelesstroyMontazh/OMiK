'use client'

import { useMemo } from 'react'
import { useExcelStore, cellRef, getSelectedRangeBounds } from '@/store/excel-store'
import { Wifi, WifiOff } from 'lucide-react'

export function StatusBar() {
  const selectedCell = useExcelStore((s) => s.selectedCell)
  const sheets = useExcelStore((s) => s.sheets)
  const activeSheetIndex = useExcelStore((s) => s.activeSheetIndex)
  const backendAvailable = useExcelStore((s) => s.backendAvailable)
  const activeFile = useExcelStore((s) => s.activeFile)

  const stats = useMemo(() => {
    const state = useExcelStore.getState()
    const bounds = getSelectedRangeBounds(state)
    if (!bounds) return { sum: null, avg: null, count: 0 }

    const sheet = sheets[activeSheetIndex]
    let sum = 0
    let count = 0
    let numericCount = 0

    for (let r = bounds.startRow; r <= bounds.endRow; r++) {
      for (let c = bounds.startCol; c <= bounds.endCol; c++) {
        const key = `${r},${c}`
        const cell = sheet.data[key]
        if (cell && cell.value !== null && cell.value !== '') {
          count++
          const num = Number(cell.value)
          if (!isNaN(num)) {
            sum += num
            numericCount++
          }
        }
      }
    }

    const avg = numericCount > 0 ? sum / numericCount : null
    return { sum, avg, count, numericCount }
  }, [sheets, activeSheetIndex])

  const formatNumber = (n: number | null) => {
    if (n === null) return '—'
    if (Number.isInteger(n)) return n.toLocaleString('ru-RU')
    return n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })
  }

  return (
    <div className="flex items-center justify-between h-5 bg-gray-50 border-t border-gray-200 px-3 flex-shrink-0">
      <div className="text-[10px] text-gray-500 flex items-center gap-3">
        <span>
          {selectedCell ? `Ячейка: ${cellRef(selectedCell.row, selectedCell.col)}` : 'Готово'}
        </span>
        {activeFile && (
          <span className="text-gray-400">| {activeFile.name}</span>
        )}
      </div>
      <div className="text-[10px] text-gray-500 flex items-center gap-3">
        {stats.count > 1 && (
          <>
            <span>Сумма: {formatNumber(stats.sum)}</span>
            <span>Среднее: {formatNumber(stats.avg)}</span>
            <span>Количество: {stats.count}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-2 text-[10px] text-gray-500">
        {backendAvailable ? (
          <span className="flex items-center gap-1 text-green-600">
            <Wifi className="h-3 w-3" />
            Python
          </span>
        ) : (
          <span className="flex items-center gap-1 text-orange-500">
            <WifiOff className="h-3 w-3" />
            Оффлайн
          </span>
        )}
      </div>
    </div>
  )
}