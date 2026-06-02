'use client'

import React, { useCallback, useRef } from 'react'
import { useExcelStore, cellRef } from '@/store/excel-store'
import { FunctionSquare } from 'lucide-react'

export default function FormulaBar() {
  const {
    selectedCell,
    sheets,
    activeSheetIndex,
    isEditing,
    editValue,
    startEditing,
    stopEditing,
    setEditValue,
  } = useExcelStore()

  const inputRef = useRef<HTMLInputElement>(null)
  const sheet = sheets[activeSheetIndex]
  const cellData = selectedCell ? sheet.data[`${selectedCell.row},${selectedCell.col}`] : null
  const cellReference = selectedCell ? cellRef(selectedCell.row, selectedCell.col) : ''

  // Display value: if editing, show editValue; otherwise show formula or value
  const displayValue = isEditing
    ? editValue
    : cellData?.formula
    ? `=${cellData.formula}`
    : String(cellData?.value ?? '')

  const handleFocus = useCallback(() => {
    if (!isEditing && selectedCell) {
      startEditing(String(cellData?.value ?? ''))
    }
  }, [isEditing, selectedCell, cellData, startEditing])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEditValue(e.target.value)
    },
    [setEditValue]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        stopEditing(true)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        stopEditing(false)
      }
    },
    [stopEditing]
  )

  const handleBlur = useCallback(() => {
    if (isEditing) {
      stopEditing(true)
    }
  }, [isEditing, stopEditing])

  // Go to cell from reference input
  const handleReferenceKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        const value = (e.target as HTMLInputElement).value.toUpperCase().trim()

        // Parse cell reference like "A1", "B23", "AA5"
        const match = value.match(/^([A-Z]+)(\d+)$/)
        if (match && selectedCell) {
          const colStr = match[1]
          const rowNum = parseInt(match[2], 10) - 1

          let col = 0
          for (let i = 0; i < colStr.length; i++) {
            col = col * 26 + (colStr.charCodeAt(i) - 64)
          }
          col -= 1

          if (rowNum >= 0 && col >= 0) {
            useExcelStore.getState().setSelectedCell(rowNum, col)
          }
        }
      }
    },
    [selectedCell]
  )

  const handleFxClick = useCallback(() => {
    if (selectedCell && !isEditing) {
      startEditing('=')
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [selectedCell, isEditing, startEditing])

  return (
    <div className="flex items-center border-b border-gray-200 bg-white h-8 flex-shrink-0">
      {/* Cell reference */}
      <div className="flex items-center border-r border-gray-200 px-2 h-full min-w-[60px]">
        <input
          className="w-full text-xs font-medium text-center outline-none bg-transparent"
          value={cellReference}
          onKeyDown={handleReferenceKeyDown}
          onChange={() => {}}
          aria-label="Ссылка на ячейку"
        />
      </div>

      {/* fx button */}
      <button
        className="flex items-center justify-center px-2 h-full border-r border-gray-200 hover:bg-gray-100 text-gray-500"
        onClick={handleFxClick}
        title="Вставить функцию"
      >
        <FunctionSquare className="h-4 w-4" />
      </button>

      {/* Formula input */}
      <div className="flex-1 h-full">
        <input
          ref={inputRef}
          className="w-full h-full px-2 text-sm outline-none bg-transparent"
          value={displayValue}
          onFocus={handleFocus}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={selectedCell ? 'Введите значение или формулу' : ''}
          aria-label="Строка формул"
        />
      </div>
    </div>
  )
}