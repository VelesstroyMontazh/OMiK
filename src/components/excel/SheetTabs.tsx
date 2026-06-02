'use client'

import React, { useCallback, useRef, useState } from 'react'
import { useExcelStore } from '@/store/excel-store'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'

export default function SheetTabs() {
  const {
    sheets,
    activeSheetIndex,
    setActiveSheet,
    addSheet,
    deleteSheet,
    renameSheet,
  } = useExcelStore()

  const scrollRef = useRef<HTMLDivElement>(null)
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const handleAddSheet = useCallback(() => {
    addSheet()
  }, [addSheet])

  const handleTabClick = useCallback(
    (index: number) => {
      setActiveSheet(index)
    },
    [setActiveSheet]
  )

  const handleDoubleClick = useCallback(
    (index: number) => {
      setRenamingIndex(index)
      setRenameValue(sheets[index].name)
    },
    [sheets]
  )

  const handleRenameConfirm = useCallback(() => {
    if (renamingIndex !== null && renameValue.trim()) {
      renameSheet(renamingIndex, renameValue.trim())
    }
    setRenamingIndex(null)
    setRenameValue('')
  }, [renamingIndex, renameValue, renameSheet])

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleRenameConfirm()
      } else if (e.key === 'Escape') {
        setRenamingIndex(null)
        setRenameValue('')
      }
    },
    [handleRenameConfirm]
  )

  const scrollLeft = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft -= 100
    }
  }, [])

  const scrollRight = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft += 100
    }
  }, [])

  const handleDeleteSheet = useCallback(
    (index: number) => {
      deleteSheet(index)
    },
    [deleteSheet]
  )

  return (
    <div className="flex items-center h-7 bg-gray-50 border-t border-gray-200 flex-shrink-0">
      {/* Add sheet button */}
      <button
        className="flex items-center justify-center w-7 h-full border-r border-gray-200 hover:bg-gray-200 text-gray-600"
        onClick={handleAddSheet}
        title="Добавить лист"
      >
        <Plus className="h-4 w-4" />
      </button>

      {/* Scroll left */}
      <button
        className="flex items-center justify-center w-5 h-full hover:bg-gray-200 text-gray-500"
        onClick={scrollLeft}
      >
        <ChevronLeft className="h-3 w-3" />
      </button>

      {/* Sheet tabs */}
      <div ref={scrollRef} className="flex items-center h-full overflow-x-auto flex-1 scrollbar-none">
        {sheets.map((sheet, index) => (
          <ContextMenu key={index}>
            <ContextMenuTrigger asChild>
              <div
                className={`flex items-center h-full px-3 text-xs border-r border-gray-200 cursor-pointer whitespace-nowrap select-none ${
                  index === activeSheetIndex
                    ? 'bg-white border-b-2 border-b-green-600 font-medium text-gray-900'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
                onClick={() => handleTabClick(index)}
                onDoubleClick={() => handleDoubleClick(index)}
              >
                {renamingIndex === index ? (
                  <input
                    className="w-16 text-xs outline-none bg-white border border-green-600 px-1"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={handleRenameKeyDown}
                    onBlur={handleRenameConfirm}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span>{sheet.name}</span>
                )}
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => handleDoubleClick(index)}>
                Переименовать
              </ContextMenuItem>
              <ContextMenuItem onClick={() => addSheet()}>
                Копировать
              </ContextMenuItem>
              <ContextMenuItem onClick={() => handleDeleteSheet(index)} disabled={sheets.length <= 1}>
                Удалить
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ))}
      </div>

      {/* Scroll right */}
      <button
        className="flex items-center justify-center w-5 h-full hover:bg-gray-200 text-gray-500"
        onClick={scrollRight}
      >
        <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  )
}