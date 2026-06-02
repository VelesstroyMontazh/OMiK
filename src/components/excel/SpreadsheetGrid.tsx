'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useExcelStore, colToLetter, getSelectedRangeBounds } from '@/store/excel-store'
import type { CellStyle } from '@/store/excel-store'

const TOTAL_ROWS = 10000
const TOTAL_COLS = 100
const DEFAULT_COL_WIDTH = 100
const DEFAULT_ROW_HEIGHT = 24
const HEADER_WIDTH = 50
const HEADER_HEIGHT = 24
const OVERSCAN = 5

function getCellStyleClasses(style?: CellStyle): string {
  const classes: string[] = []
  if (style?.bold) classes.push('font-bold')
  if (style?.italic) classes.push('italic')
  if (style?.underline) classes.push('underline')
  if (style?.strikethrough) classes.push('line-through')
  if (style?.alignment === 'left') classes.push('text-left')
  else if (style?.alignment === 'center') classes.push('text-center')
  else if (style?.alignment === 'right') classes.push('text-right')
  else classes.push('text-left')
  if (style?.verticalAlignment === 'top') classes.push('align-top')
  else if (style?.verticalAlignment === 'middle') classes.push('align-middle')
  else if (style?.verticalAlignment === 'bottom') classes.push('align-bottom')
  if (style?.wrapText) classes.push('whitespace-normal break-words')
  return classes.join(' ')
}

function getInlineStyle(style?: CellStyle): React.CSSProperties {
  const css: React.CSSProperties = {}
  if (style?.backgroundColor) css.backgroundColor = style.backgroundColor
  if (style?.textColor) css.color = style.textColor
  if (style?.fontSize) css.fontSize = `${style.fontSize}px`
  if (style?.fontFamily) css.fontFamily = style.fontFamily
  return css
}

function formatCellValue(value: string | number | null, numberFormat?: string): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (!numberFormat || numberFormat === 'general') return str

  const num = Number(value)
  if (isNaN(num)) return str

  switch (numberFormat) {
    case 'number':
      return num.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    case 'currency':
      return num.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })
    case 'percentage':
      return `${(num * 100).toFixed(2)}%`
    case 'date':
      return new Date(num).toLocaleDateString('ru-RU')
    case 'time':
      return new Date(num).toLocaleTimeString('ru-RU')
    default:
      return str
  }
}

export default function SpreadsheetGrid() {
  const containerRef = useRef<HTMLDivElement>(null)
  const editingInputRef = useRef<HTMLTextAreaElement>(null)

  const {
    sheets,
    activeSheetIndex,
    selectedCell,
    selectedRange,
    selectionAnchor,
    isEditing,
    editValue,
    setSelectedCell,
    setSelectedRange,
    setSelectionAnchor,
    startEditing,
    stopEditing,
    setEditValue,
    setContextMenuPosition,
    setColumnWidth,
    setRowHeight,
  } = useExcelStore()

  const sheet = sheets[activeSheetIndex]

  // Scroll state
  const [scrollTop, setScrollTop] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)

  // Resize state
  const [resizingCol, setResizingCol] = useState<number | null>(null)
  const [resizingRow, setResizingRow] = useState<number | null>(null)
  const [resizeStartX, setResizeStartX] = useState(0)
  const [resizeStartY, setResizeStartY] = useState(0)
  const [resizeStartSize, setResizeStartSize] = useState(0)

  // Calculate visible range
  const colWidths = useMemo(() => {
    const widths: number[] = []
    for (let c = 0; c < TOTAL_COLS; c++) {
      widths.push(sheet.columnWidths[c] || DEFAULT_COL_WIDTH)
    }
    return widths
  }, [sheet.columnWidths])

  const rowHeights = useMemo(() => {
    const heights: number[] = []
    for (let r = 0; r < TOTAL_ROWS; r++) {
      heights.push(sheet.rowHeights[r] || DEFAULT_ROW_HEIGHT)
    }
    return heights
  }, [sheet.rowHeights])

  // Compute visible rows/cols
  const visibleRange = useMemo(() => {
    let startCol = 0
    let cumWidth = 0
    for (let c = 0; c < TOTAL_COLS; c++) {
      if (cumWidth + colWidths[c] > scrollLeft) {
        startCol = Math.max(0, c - OVERSCAN)
        break
      }
      cumWidth += colWidths[c]
    }

    let endCol = startCol
    cumWidth = 0
    for (let c = startCol; c < TOTAL_COLS; c++) {
      cumWidth += colWidths[c]
      endCol = c
      if (cumWidth > (containerRef.current?.clientWidth || 1200) - HEADER_WIDTH + scrollLeft + OVERSCAN * DEFAULT_COL_WIDTH) {
        break
      }
    }
    endCol = Math.min(TOTAL_COLS - 1, endCol + OVERSCAN)

    let startRow = 0
    let cumHeight = 0
    for (let r = 0; r < TOTAL_ROWS; r++) {
      if (cumHeight + rowHeights[r] > scrollTop) {
        startRow = Math.max(0, r - OVERSCAN)
        break
      }
      cumHeight += rowHeights[r]
    }

    let endRow = startRow
    cumHeight = 0
    for (let r = startRow; r < TOTAL_ROWS; r++) {
      cumHeight += rowHeights[r]
      endRow = r
      if (cumHeight > (containerRef.current?.clientHeight || 800) - HEADER_HEIGHT + scrollTop + OVERSCAN * DEFAULT_ROW_HEIGHT) {
        break
      }
    }
    endRow = Math.min(TOTAL_ROWS - 1, endRow + OVERSCAN)

    return { startRow, endRow, startCol, endCol }
  }, [scrollTop, scrollLeft, colWidths, rowHeights])

  // Calculate total scrollable area
  const totalWidth = useMemo(() => colWidths.reduce((a, b) => a + b, 0), [colWidths])
  const totalHeight = useMemo(() => {
    // For performance, approximate instead of summing all 10000 rows
    return TOTAL_ROWS * DEFAULT_ROW_HEIGHT
  }, [])

  // Position for each visible row/col
  const colPositions = useMemo(() => {
    const positions: number[] = []
    let pos = 0
    for (let c = 0; c <= visibleRange.endCol; c++) {
      if (c >= visibleRange.startCol) {
        positions.push(pos)
      }
      pos += colWidths[c] || DEFAULT_COL_WIDTH
    }
    return positions
  }, [visibleRange, colWidths])

  const rowPositions = useMemo(() => {
    const positions: number[] = []
    let pos = 0
    for (let r = 0; r <= visibleRange.endRow; r++) {
      if (r >= visibleRange.startRow) {
        positions.push(pos)
      }
      pos += rowHeights[r] || DEFAULT_ROW_HEIGHT
    }
    return positions
  }, [visibleRange, rowHeights])

  // Scroll handler
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
    setScrollLeft(e.currentTarget.scrollLeft)
  }, [])

  // Cell click
  const handleCellClick = useCallback(
    (row: number, col: number, e: React.MouseEvent) => {
      if (isEditing) {
        stopEditing(true)
      }

      if (e.shiftKey && selectionAnchor) {
        setSelectedRange({
          startRow: selectionAnchor.row,
          startCol: selectionAnchor.col,
          endRow: row,
          endCol: col,
        })
      } else if (e.ctrlKey || e.metaKey) {
        // Multi-select not implemented yet - just select
        setSelectedCell(row, col)
      } else {
        setSelectedCell(row, col)
      }
    },
    [isEditing, selectionAnchor, stopEditing, setSelectedCell, setSelectedRange]
  )

  // Cell double click
  const handleCellDoubleClick = useCallback(
    (row: number, col: number) => {
      setSelectedCell(row, col)
      startEditing()
    },
    [setSelectedCell, startEditing]
  )

  // Right click
  const handleCellContextMenu = useCallback(
    (row: number, col: number, e: React.MouseEvent) => {
      e.preventDefault()
      setSelectedCell(row, col)
      setContextMenuPosition({ x: e.clientX, y: e.clientY, row, col })
    },
    [setSelectedCell, setContextMenuPosition]
  )

  // Key handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!selectedCell) return

      const { row, col } = selectedCell

      if (isEditing) {
        switch (e.key) {
          case 'Enter':
            e.preventDefault()
            stopEditing(true)
            // Move down
            if (row + 1 < TOTAL_ROWS) {
              setSelectedCell(row + 1, col)
            }
            break
          case 'Escape':
            e.preventDefault()
            stopEditing(false)
            break
          case 'Tab':
            e.preventDefault()
            stopEditing(true)
            if (col + 1 < TOTAL_COLS) {
              setSelectedCell(row, col + 1)
            }
            break
        }
        return
      }

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          if (row > 0) setSelectedCell(row - 1, col)
          break
        case 'ArrowDown':
          e.preventDefault()
          if (row < TOTAL_ROWS - 1) setSelectedCell(row + 1, col)
          break
        case 'ArrowLeft':
          e.preventDefault()
          if (col > 0) setSelectedCell(row, col - 1)
          break
        case 'ArrowRight':
          e.preventDefault()
          if (col < TOTAL_COLS - 1) setSelectedCell(row, col + 1)
          break
        case 'Enter':
          e.preventDefault()
          startEditing()
          break
        case 'Tab':
          e.preventDefault()
          if (col + 1 < TOTAL_COLS) setSelectedCell(row, col + 1)
          break
        case 'Delete':
        case 'Backspace':
          e.preventDefault()
          useExcelStore.getState().setCellValue(row, col, '')
          break
        case 'F2':
          e.preventDefault()
          startEditing()
          break
        default:
          // Start typing to edit
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            startEditing(e.key)
          }
          break
      }
    },
    [selectedCell, isEditing, setSelectedCell, startEditing, stopEditing]
  )

  // Focus the grid container
  useEffect(() => {
    if (containerRef.current && !isEditing) {
      containerRef.current.focus()
    }
  }, [isEditing, selectedCell])

  // Auto-focus editing input
  useEffect(() => {
    if (isEditing && editingInputRef.current) {
      editingInputRef.current.focus()
    }
  }, [isEditing])

  // Copy/paste
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'c') {
          useExcelStore.getState().copySelection()
        } else if (e.key === 'x') {
          useExcelStore.getState().cutSelection()
        } else if (e.key === 'v') {
          useExcelStore.getState().pasteSelection()
        } else if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault()
          useExcelStore.getState().undo()
        } else if (e.key === 'z' && e.shiftKey) {
          e.preventDefault()
          useExcelStore.getState().redo()
        } else if (e.key === 'y') {
          e.preventDefault()
          useExcelStore.getState().redo()
        } else if (e.key === 'f' || e.key === 'h') {
          e.preventDefault()
          useExcelStore.getState().setFindReplaceOpen(true)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Column resize handlers
  const handleColResizeStart = useCallback(
    (col: number, e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setResizingCol(col)
      setResizeStartX(e.clientX)
      setResizeStartSize(sheet.columnWidths[col] || DEFAULT_COL_WIDTH)
    },
    [sheet.columnWidths]
  )

  const handleRowResizeStart = useCallback(
    (row: number, e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setResizingRow(row)
      setResizeStartY(e.clientY)
      setResizeStartSize(sheet.rowHeights[row] || DEFAULT_ROW_HEIGHT)
    },
    [sheet.rowHeights]
  )

  useEffect(() => {
    if (resizingCol === null && resizingRow === null) return

    const handleMouseMove = (e: MouseEvent) => {
      if (resizingCol !== null) {
        const diff = e.clientX - resizeStartX
        const newWidth = Math.max(30, resizeStartSize + diff)
        setColumnWidth(resizingCol, newWidth)
      }
      if (resizingRow !== null) {
        const diff = e.clientY - resizeStartY
        const newHeight = Math.max(16, resizeStartSize + diff)
        setRowHeight(resizingRow, newHeight)
      }
    }

    const handleMouseUp = () => {
      setResizingCol(null)
      setResizingRow(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizingCol, resizingRow, resizeStartX, resizeStartY, resizeStartSize, setColumnWidth, setRowHeight])

  // Selection range bounds for highlighting
  const selectionBounds = useMemo(() => {
    const state = useExcelStore.getState()
    return getSelectedRangeBounds({ ...state, selectedRange })
  }, [selectedRange])

  // Merged cell lookup
  const mergedCellLookup = useMemo(() => {
    const lookup: Record<string, { merge: typeof sheet.mergedCells[0]; isOrigin: boolean }> = {}
    for (const merge of sheet.mergedCells) {
      for (let r = merge.startRow; r <= merge.endRow; r++) {
        for (let c = merge.startCol; c <= merge.endCol; c++) {
          lookup[`${r},${c}`] = { merge, isOrigin: r === merge.startRow && c === merge.startCol }
        }
      }
    }
    return lookup
  }, [sheet])

  const isInSelection = useCallback(
    (row: number, col: number) => {
      if (!selectionBounds) return false
      return (
        row >= selectionBounds.startRow &&
        row <= selectionBounds.endRow &&
        col >= selectionBounds.startCol &&
        col <= selectionBounds.endCol
      )
    },
    [selectionBounds]
  )

  const isSelected = useCallback(
    (row: number, col: number) => {
      return selectedCell?.row === row && selectedCell?.col === col
    },
    [selectedCell]
  )

  const isHeaderActive = useCallback(
    (type: 'row' | 'col', index: number) => {
      if (!selectionBounds) return false
      if (type === 'row') {
        return index >= selectionBounds.startRow && index <= selectionBounds.endRow
      }
      return index >= selectionBounds.startCol && index <= selectionBounds.endCol
    },
    [selectionBounds]
  )

  // Row header click (select entire row)
  const handleRowHeaderClick = useCallback(
    (row: number, _e: React.MouseEvent) => {
      if (isEditing) stopEditing(true)
      setSelectedCell(row, 0)
      setSelectedRange({ startRow: row, startCol: 0, endRow: row, endCol: TOTAL_COLS - 1 })
      setSelectionAnchor({ row, col: 0 })
    },
    [isEditing, stopEditing, setSelectedCell, setSelectedRange, setSelectionAnchor]
  )

  // Col header click (select entire column)
  const handleColHeaderClick = useCallback(
    (col: number, _e: React.MouseEvent) => {
      if (isEditing) stopEditing(true)
      setSelectedCell(0, col)
      setSelectedRange({ startRow: 0, startCol: col, endRow: TOTAL_ROWS - 1, endCol: col })
      setSelectionAnchor({ row: 0, col })
    },
    [isEditing, stopEditing, setSelectedCell, setSelectedRange, setSelectionAnchor]
  )

  // Select all
  const handleSelectAll = useCallback(() => {
    if (isEditing) stopEditing(true)
    setSelectedCell(0, 0)
    setSelectedRange({ startRow: 0, startCol: 0, endRow: TOTAL_ROWS - 1, endCol: TOTAL_COLS - 1 })
    setSelectionAnchor({ row: 0, col: 0 })
  }, [isEditing, stopEditing, setSelectedCell, setSelectedRange, setSelectionAnchor])

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-auto outline-none border border-gray-200 bg-white"
      onScroll={handleScroll}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      style={{ userSelect: 'none' }}
    >
      {/* Total scrollable area */}
      <div style={{ width: totalWidth + HEADER_WIDTH, height: totalHeight + HEADER_HEIGHT, position: 'relative' }}>
        {/* Fixed corner */}
        <div
          className="sticky top-0 left-0 z-30 bg-gray-100 border-b border-r border-gray-300 flex items-center justify-center cursor-pointer"
          style={{ width: HEADER_WIDTH, height: HEADER_HEIGHT, minWidth: HEADER_WIDTH }}
          onClick={handleSelectAll}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" className="text-gray-500">
            <path d="M2 0v10h10V0H2zm9 1v8H3V1h8z" fill="currentColor" />
            <path d="M0 2h1v8H0zM2 10v1h8v1H2z" fill="currentColor" />
          </svg>
        </div>

        {/* Column headers */}
        {Array.from({ length: visibleRange.endCol - visibleRange.startCol + 1 }, (_, i) => {
          const c = visibleRange.startCol + i
          const w = colWidths[c] || DEFAULT_COL_WIDTH
          const left = colPositions[i] + HEADER_WIDTH
          return (
            <div
              key={`col-${c}`}
              className={`sticky top-0 z-20 border-b border-r border-gray-300 flex items-center justify-center text-xs font-medium select-none ${
                isHeaderActive('col', c) ? 'bg-gray-300 text-gray-800' : 'bg-gray-100 text-gray-700'
              }`}
              style={{
                position: 'absolute',
                left,
                top: 0,
                width: w,
                height: HEADER_HEIGHT,
              }}
              onClick={(e) => handleColHeaderClick(c, e)}
            >
              {colToLetter(c)}
              {/* Column resize handle */}
              <div
                className="absolute right-0 top-0 w-1.5 h-full cursor-col-resize hover:bg-green-500/30"
                onMouseDown={(e) => handleColResizeStart(c, e)}
              />
            </div>
          )
        })}

        {/* Row headers */}
        {Array.from({ length: visibleRange.endRow - visibleRange.startRow + 1 }, (_, i) => {
          const r = visibleRange.startRow + i
          const h = rowHeights[r] || DEFAULT_ROW_HEIGHT
          const top = rowPositions[i] + HEADER_HEIGHT
          return (
            <div
              key={`row-${r}`}
              className={`sticky left-0 z-10 border-b border-r border-gray-300 flex items-center justify-center text-xs font-medium select-none ${
                isHeaderActive('row', r) ? 'bg-gray-300 text-gray-800' : 'bg-gray-100 text-gray-700'
              }`}
              style={{
                position: 'absolute',
                left: 0,
                top,
                width: HEADER_WIDTH,
                height: h,
              }}
              onClick={(e) => handleRowHeaderClick(r, e)}
            >
              {r + 1}
              {/* Row resize handle */}
              <div
                className="absolute bottom-0 left-0 w-full h-1.5 cursor-row-resize hover:bg-green-500/30"
                onMouseDown={(e) => handleRowResizeStart(r, e)}
              />
            </div>
          )
        })}

        {/* Cells */}
        {Array.from({ length: visibleRange.endRow - visibleRange.startRow + 1 }, (_, ri) => {
          const r = visibleRange.startRow + ri
          const top = rowPositions[ri] + HEADER_HEIGHT
          const h = rowHeights[r] || DEFAULT_ROW_HEIGHT

          return Array.from({ length: visibleRange.endCol - visibleRange.startCol + 1 }, (_, ci) => {
            const c = visibleRange.startCol + ci
            const left = colPositions[ci] + HEADER_WIDTH
            const w = colWidths[c] || DEFAULT_COL_WIDTH
            const key = `${r},${c}`
            const cellData = sheet.data[key]
            const merged = mergedCellLookup[key]

            // Skip non-origin merged cells
            if (merged && !merged.isOrigin) return null

            // Calculate merged cell dimensions
            let cellWidth = w
            let cellHeight = h
            if (merged?.isOrigin) {
              const m = merged.merge
              cellWidth = 0
              cellHeight = 0
              for (let mc = m.startCol; mc <= m.endCol; mc++) {
                cellWidth += colWidths[mc] || DEFAULT_COL_WIDTH
              }
              for (let mr = m.startRow; mr <= m.endRow; mr++) {
                cellHeight += rowHeights[mr] || DEFAULT_ROW_HEIGHT
              }
            }

            const selected = isSelected(r, c)
            const inSelection = isInSelection(r, c)
            const isEditingThis = selected && isEditing

            const displayValue = formatCellValue(cellData?.value ?? null, cellData?.numberFormat)
            const formulaDisplay = cellData?.formula ? `=${cellData.formula}` : displayValue

            return (
              <div
                key={key}
                className={`absolute border-b border-r border-gray-200 overflow-hidden ${
                  selected
                    ? 'border-2 border-green-600 z-10'
                    : inSelection
                    ? 'bg-green-50/50'
                    : ''
                } ${getCellStyleClasses(cellData?.style)}`}
                style={{
                  left,
                  top,
                  width: cellWidth,
                  height: cellHeight,
                  ...getInlineStyle(cellData?.style),
                  ...(merged?.isOrigin ? { zIndex: 5 } : {}),
                }}
                onClick={(e) => handleCellClick(r, c, e)}
                onDoubleClick={() => handleCellDoubleClick(r, c)}
                onContextMenu={(e) => handleCellContextMenu(r, c, e)}
              >
                {isEditingThis ? (
                  <textarea
                    ref={editingInputRef}
                    className="w-full h-full resize-none border-none outline-none bg-white p-0.5 text-sm"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        e.stopPropagation()
                      }
                      if (e.key === 'Escape') {
                        e.stopPropagation()
                      }
                      if (e.key === 'Tab') {
                        e.preventDefault()
                        e.stopPropagation()
                      }
                    }}
                    style={{
                      fontFamily: cellData?.style?.fontFamily || 'inherit',
                      fontSize: cellData?.style?.fontSize ? `${cellData.style.fontSize}px` : '13px',
                    }}
                  />
                ) : (
                  <div className="w-full h-full px-1 py-0.5 text-sm truncate" title={formulaDisplay}>
                    {displayValue}
                  </div>
                )}
              </div>
            )
          })
        })}
      </div>
    </div>
  )
}
