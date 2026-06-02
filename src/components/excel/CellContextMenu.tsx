'use client'

import React, { useCallback } from 'react'
import { useExcelStore } from '@/store/excel-store'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Scissors,
  Copy,
  Clipboard,
  Rows3,
  Columns3,
  Trash2,
  ArrowUpDown,
  ArrowDownUp,
  Filter,
  TableCellsMerge,
  Paintbrush,
} from 'lucide-react'

export default function CellContextMenu() {
  const {
    contextMenuPosition,
    setContextMenuPosition,
    cutSelection,
    copySelection,
    pasteSelection,
    insertRow,
    insertColumn,
    deleteRow,
    deleteColumn,
    mergeCells,
    unmergeCells,
  } = useExcelStore()

  const handleClose = useCallback(() => {
    setContextMenuPosition(null)
  }, [setContextMenuPosition])

  if (!contextMenuPosition) return null

  const { row, col } = contextMenuPosition

  const handleInsertRowAbove = () => {
    insertRow(row)
    handleClose()
  }

  const handleInsertRowBelow = () => {
    insertRow(row + 1)
    handleClose()
  }

  const handleInsertColLeft = () => {
    insertColumn(col)
    handleClose()
  }

  const handleInsertColRight = () => {
    insertColumn(col + 1)
    handleClose()
  }

  const handleDeleteRowAction = () => {
    deleteRow(row)
    handleClose()
  }

  const handleDeleteColAction = () => {
    deleteColumn(col)
    handleClose()
  }

  const handleMerge = () => {
    const state = useExcelStore.getState()
    const range = state.selectedRange || {
      startRow: row,
      startCol: col,
      endRow: row,
      endCol: col,
    }
    if (range.startRow !== range.endRow || range.startCol !== range.endCol) {
      mergeCells(range)
    }
    handleClose()
  }

  const handleUnmerge = () => {
    const state = useExcelStore.getState()
    const range = state.selectedRange || {
      startRow: row,
      startCol: col,
      endRow: row,
      endCol: col,
    }
    unmergeCells(range)
    handleClose()
  }

  return (
    <ContextMenu
      onOpenChange={(open) => {
        if (!open) handleClose()
      }}
    >
      <ContextMenuTrigger
        style={{
          position: 'fixed',
          left: contextMenuPosition.x,
          top: contextMenuPosition.y,
          width: 1,
          height: 1,
          pointerEvents: 'auto',
        }}
      />
      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={() => { cutSelection(); handleClose() }}>
          <Scissors className="mr-2 h-4 w-4" />
          Вырезать
          <span className="ml-auto text-xs text-muted-foreground">Ctrl+X</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => { copySelection(); handleClose() }}>
          <Copy className="mr-2 h-4 w-4" />
          Копировать
          <span className="ml-auto text-xs text-muted-foreground">Ctrl+C</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => { pasteSelection(); handleClose() }}>
          <Clipboard className="mr-2 h-4 w-4" />
          Вставить
          <span className="ml-auto text-xs text-muted-foreground">Ctrl+V</span>
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Rows3 className="mr-2 h-4 w-4" />
            Вставить строку
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onClick={handleInsertRowAbove}>Выше</ContextMenuItem>
            <ContextMenuItem onClick={handleInsertRowBelow}>Ниже</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Columns3 className="mr-2 h-4 w-4" />
            Вставить столбец
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onClick={handleInsertColLeft}>Слева</ContextMenuItem>
            <ContextMenuItem onClick={handleInsertColRight}>Справа</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={handleDeleteRowAction}>
          <Trash2 className="mr-2 h-4 w-4" />
          Удалить строку
        </ContextMenuItem>
        <ContextMenuItem onClick={handleDeleteColAction}>
          <Trash2 className="mr-2 h-4 w-4" />
          Удалить столбец
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={handleMerge}>
          <TableCellsMerge className="mr-2 h-4 w-4" />
          Объединить ячейки
        </ContextMenuItem>
        <ContextMenuItem onClick={handleUnmerge}>
          <TableCellsMerge className="mr-2 h-4 w-4" />
          Разъединить ячейки
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={() => handleClose()}>
          <ArrowUpDown className="mr-2 h-4 w-4" />
          Сортировка по возрастанию
        </ContextMenuItem>
        <ContextMenuItem onClick={() => handleClose()}>
          <ArrowDownUp className="mr-2 h-4 w-4" />
          Сортировка по убыванию
        </ContextMenuItem>
        <ContextMenuItem onClick={() => handleClose()}>
          <Filter className="mr-2 h-4 w-4" />
          Фильтр по значению
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={() => handleClose()}>
          <Paintbrush className="mr-2 h-4 w-4" />
          Формат ячеек...
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}