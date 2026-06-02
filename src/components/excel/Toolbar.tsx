'use client'

import React, { useCallback } from 'react'
import { useExcelStore, getSelectedRangeBounds, colToLetter } from '@/store/excel-store'
import type { CellStyle, NumberFormat } from '@/store/excel-store'
import { useExcelApi } from '@/hooks/use-excel-api'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import ColorPicker from '@/components/excel/ColorPicker'
import {
  FilePlus,
  FolderOpen,
  Save,
  Download,
  Undo2,
  Redo2,
  Scissors,
  Copy,
  Clipboard,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  WrapText,
  TableCellsMerge,
  ArrowUpDown,
  ArrowDownUp,
  Filter,
  Search,
  Code2,
  BarChart3,
  Rows3,
  Columns3,
  Trash2,
  Palette,
  Type,
} from 'lucide-react'

const FONT_FAMILIES = [
  'Arial',
  'Calibri',
  'Courier New',
  'Georgia',
  'Times New Roman',
  'Verdana',
  'Comic Sans MS',
  'Impact',
  'Tahoma',
  'Trebuchet MS',
]

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72]

const NUMBER_FORMATS: { value: NumberFormat; label: string }[] = [
  { value: 'general', label: 'Общий' },
  { value: 'number', label: 'Числовой' },
  { value: 'currency', label: 'Валюта' },
  { value: 'percentage', label: 'Процентный' },
  { value: 'date', label: 'Дата' },
  { value: 'time', label: 'Время' },
]

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  active,
  disabled,
}: {
  icon: React.ElementType
  label: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={active ? 'secondary' : 'ghost'}
            size="icon"
            className="h-7 w-7"
            onClick={onClick}
            disabled={disabled}
          >
            <Icon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function ToolbarGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5 px-1">{children}</div>
}

export default function Toolbar() {
  const {
    selectedCell,
    sheets,
    activeSheetIndex,
    activeFile,
    currentFilePath,
    setCellStyle,
    setRangeStyle,
    undo,
    redo,
    copySelection,
    cutSelection,
    pasteSelection,
    insertRow,
    insertColumn,
    deleteRow,
    deleteColumn,
    mergeCells,
    unmergeCells,
    setFindReplaceOpen,
    setMacroEditorOpen,
    setSidebarOpen,
    setSidebarTab,
    setNumberFormat,
    setError,
  } = useExcelStore()

  const api = useExcelApi()
  const sheet = sheets[activeSheetIndex]
  const currentCell = selectedCell ? sheet.data[`${selectedCell.row},${selectedCell.col}`] : null
  const currentStyle = currentCell?.style || {}
  const hasActiveFile = !!activeFile

  const applyStyle = useCallback(
    (style: Partial<CellStyle>) => {
      const state = useExcelStore.getState()
      const range = getSelectedRangeBounds(state)
      if (range && (range.startRow !== range.endRow || range.startCol !== range.endCol)) {
        setRangeStyle(range, style)
      } else if (selectedCell) {
        setCellStyle(selectedCell.row, selectedCell.col, style)
      }
    },
    [selectedCell, setCellStyle, setRangeStyle]
  )

  const toggleBold = useCallback(() => {
    applyStyle({ bold: !currentStyle.bold })
  }, [applyStyle, currentStyle.bold])

  const toggleItalic = useCallback(() => {
    applyStyle({ italic: !currentStyle.italic })
  }, [applyStyle, currentStyle.italic])

  const toggleUnderline = useCallback(() => {
    applyStyle({ underline: !currentStyle.underline })
  }, [applyStyle, currentStyle.underline])

  const toggleStrikethrough = useCallback(() => {
    applyStyle({ strikethrough: !currentStyle.strikethrough })
  }, [applyStyle, currentStyle.strikethrough])

  const setAlignment = useCallback(
    (alignment: 'left' | 'center' | 'right') => {
      applyStyle({ alignment })
    },
    [applyStyle]
  )

  const setVerticalAlignment = useCallback(
    (verticalAlignment: 'top' | 'middle' | 'bottom') => {
      applyStyle({ verticalAlignment })
    },
    [applyStyle]
  )

  const toggleWrapText = useCallback(() => {
    applyStyle({ wrapText: !currentStyle.wrapText })
  }, [applyStyle, currentStyle.wrapText])

  const handleFontFamily = useCallback(
    (fontFamily: string) => {
      applyStyle({ fontFamily })
    },
    [applyStyle]
  )

  const handleFontSize = useCallback(
    (fontSizeStr: string) => {
      applyStyle({ fontSize: parseInt(fontSizeStr, 10) })
    },
    [applyStyle]
  )

  const handleTextColor = useCallback(
    (color: string) => {
      applyStyle({ textColor: color })
    },
    [applyStyle]
  )

  const handleBackgroundColor = useCallback(
    (color: string) => {
      applyStyle({ backgroundColor: color })
    },
    [applyStyle]
  )

  const handleMerge = useCallback(() => {
    const state = useExcelStore.getState()
    const range = getSelectedRangeBounds(state)
    if (!range) return

    if (range.startRow === range.endRow && range.startCol === range.endCol) return

    // Check if already merged
    const alreadyMerged = sheet.mergedCells.some(
      (m) =>
        m.startRow === range.startRow &&
        m.endRow === range.endRow &&
        m.startCol === range.startCol &&
        m.endCol === range.endCol
    )

    if (alreadyMerged) {
      unmergeCells(range)
    } else {
      mergeCells(range)
    }
  }, [sheet.mergedCells, mergeCells, unmergeCells])

  const handleNumberFormat = useCallback(
    (format: string) => {
      const state = useExcelStore.getState()
      const range = getSelectedRangeBounds(state)
      if (range) {
        setNumberFormat(range, format as NumberFormat)
      }
    },
    [setNumberFormat]
  )

  const handleInsertRow = useCallback(() => {
    if (selectedCell) {
      insertRow(selectedCell.row)
    }
  }, [selectedCell, insertRow])

  const handleInsertColumn = useCallback(() => {
    if (selectedCell) {
      insertColumn(selectedCell.col)
    }
  }, [selectedCell, insertColumn])

  const handleDeleteRow = useCallback(() => {
    if (selectedCell) {
      deleteRow(selectedCell.row)
    }
  }, [selectedCell, deleteRow])

  const handleDeleteColumn = useCallback(() => {
    if (selectedCell) {
      deleteColumn(selectedCell.col)
    }
  }, [selectedCell, deleteColumn])

  const handleSortAsc = useCallback(async () => {
    if (!currentFilePath || !hasActiveFile || !selectedCell) return
    try {
      const colLetter = colToLetter(selectedCell.col)
      await api.sortData(currentFilePath, sheet.name, colLetter, true)
      // Reload data
      const result = await api.fetchSheetData(currentFilePath, sheet.name)
      useExcelStore.getState().loadApiSheetData(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сортировки')
    }
  }, [currentFilePath, hasActiveFile, selectedCell, sheet.name, api, setError])

  const handleSortDesc = useCallback(async () => {
    if (!currentFilePath || !hasActiveFile || !selectedCell) return
    try {
      const colLetter = colToLetter(selectedCell.col)
      await api.sortData(currentFilePath, sheet.name, colLetter, false)
      // Reload data
      const result = await api.fetchSheetData(currentFilePath, sheet.name)
      useExcelStore.getState().loadApiSheetData(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сортировки')
    }
  }, [currentFilePath, hasActiveFile, selectedCell, sheet.name, api, setError])

  const handleDownload = useCallback(async () => {
    if (!activeFile) return
    try {
      await api.downloadFile(activeFile.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка экспорта в Excel')
    }
  }, [activeFile, api, setError])

  const handleNew = useCallback(() => {
    useExcelStore.getState().resetToEmpty()
  }, [])

  return (
    <div className="flex items-center gap-0 border-b border-gray-200 bg-gray-50 px-2 py-1 overflow-x-auto flex-shrink-0">
      {/* File group */}
      <ToolbarGroup>
        <ToolbarButton icon={FilePlus} label="Новый" onClick={handleNew} />
        <ToolbarButton icon={FolderOpen} label="Открыть" onClick={() => { setSidebarOpen(true); setSidebarTab('files') }} />
        <ToolbarButton icon={Save} label="Сохранить" onClick={() => {}} disabled={!hasActiveFile} />
        <ToolbarButton icon={Download} label="Экспорт в Excel" onClick={handleDownload} disabled={!hasActiveFile} />
      </ToolbarGroup>

      <Separator orientation="vertical" className="h-6" />

      {/* Edit group */}
      <ToolbarGroup>
        <ToolbarButton icon={Undo2} label="Отменить (Ctrl+Z)" onClick={undo} />
        <ToolbarButton icon={Redo2} label="Повторить (Ctrl+Y)" onClick={redo} />
        <Separator orientation="vertical" className="h-6 mx-1" />
        <ToolbarButton icon={Scissors} label="Вырезать (Ctrl+X)" onClick={cutSelection} />
        <ToolbarButton icon={Copy} label="Копировать (Ctrl+C)" onClick={copySelection} />
        <ToolbarButton icon={Clipboard} label="Вставить (Ctrl+V)" onClick={pasteSelection} />
      </ToolbarGroup>

      <Separator orientation="vertical" className="h-6" />

      {/* Font group */}
      <ToolbarGroup>
        <Select value={currentStyle.fontFamily || 'Calibri'} onValueChange={handleFontFamily}>
          <SelectTrigger className="h-7 w-[120px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_FAMILIES.map((f) => (
              <SelectItem key={f} value={f}>
                <span style={{ fontFamily: f }}>{f}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={String(currentStyle.fontSize || 13)}
          onValueChange={handleFontSize}
        >
          <SelectTrigger className="h-7 w-[60px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_SIZES.map((s) => (
              <SelectItem key={s} value={String(s)}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <ToolbarButton icon={Bold} label="Жирный (Ctrl+B)" onClick={toggleBold} active={currentStyle.bold} />
        <ToolbarButton icon={Italic} label="Курсив (Ctrl+I)" onClick={toggleItalic} active={currentStyle.italic} />
        <ToolbarButton icon={Underline} label="Подчёркнутый (Ctrl+U)" onClick={toggleUnderline} active={currentStyle.underline} />
        <ToolbarButton icon={Strikethrough} label="Зачёркнутый" onClick={toggleStrikethrough} active={currentStyle.strikethrough} />
      </ToolbarGroup>

      <Separator orientation="vertical" className="h-6" />

      {/* Color group */}
      <ToolbarGroup>
        <ColorPicker
          color={currentStyle.textColor}
          onChange={handleTextColor}
          icon={<Type className="h-4 w-4" />}
          label="Цвет текста"
        />
        <ColorPicker
          color={currentStyle.backgroundColor}
          onChange={handleBackgroundColor}
          icon={<Palette className="h-4 w-4" />}
          label="Цвет фона"
        />
      </ToolbarGroup>

      <Separator orientation="vertical" className="h-6" />

      {/* Alignment group */}
      <ToolbarGroup>
        <ToolbarButton icon={AlignLeft} label="По левому краю" onClick={() => setAlignment('left')} active={currentStyle.alignment === 'left'} />
        <ToolbarButton icon={AlignCenter} label="По центру" onClick={() => setAlignment('center')} active={currentStyle.alignment === 'center'} />
        <ToolbarButton icon={AlignRight} label="По правому краю" onClick={() => setAlignment('right')} active={currentStyle.alignment === 'right'} />
        <Separator orientation="vertical" className="h-6 mx-1" />
        <ToolbarButton icon={AlignVerticalJustifyStart} label="По верхнему краю" onClick={() => setVerticalAlignment('top')} active={currentStyle.verticalAlignment === 'top'} />
        <ToolbarButton icon={AlignVerticalJustifyCenter} label="По центру вертикали" onClick={() => setVerticalAlignment('middle')} active={currentStyle.verticalAlignment === 'middle'} />
        <ToolbarButton icon={AlignVerticalJustifyEnd} label="По нижнему краю" onClick={() => setVerticalAlignment('bottom')} active={currentStyle.verticalAlignment === 'bottom'} />
        <ToolbarButton icon={WrapText} label="Перенос текста" onClick={toggleWrapText} active={currentStyle.wrapText} />
        <ToolbarButton icon={TableCellsMerge} label="Объединить ячейки" onClick={handleMerge} />
      </ToolbarGroup>

      <Separator orientation="vertical" className="h-6" />

      {/* Number format group */}
      <ToolbarGroup>
        <Select value={currentCell?.numberFormat || 'general'} onValueChange={handleNumberFormat}>
          <SelectTrigger className="h-7 w-[110px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {NUMBER_FORMATS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ToolbarGroup>

      <Separator orientation="vertical" className="h-6" />

      {/* Cell group */}
      <ToolbarGroup>
        <ToolbarButton icon={Rows3} label="Вставить строку" onClick={handleInsertRow} />
        <ToolbarButton icon={Columns3} label="Вставить столбец" onClick={handleInsertColumn} />
        <ToolbarButton icon={Trash2} label="Удалить строку" onClick={handleDeleteRow} />
        <ToolbarButton icon={Trash2} label="Удалить столбец" onClick={handleDeleteColumn} />
      </ToolbarGroup>

      <Separator orientation="vertical" className="h-6" />

      {/* Data group */}
      <ToolbarGroup>
        <ToolbarButton icon={ArrowUpDown} label="Сортировка А-Я" onClick={handleSortAsc} disabled={!hasActiveFile} />
        <ToolbarButton icon={ArrowDownUp} label="Сортировка Я-А" onClick={handleSortDesc} disabled={!hasActiveFile} />
        <ToolbarButton icon={Filter} label="Фильтр" onClick={() => {}} disabled={!hasActiveFile} />
        <ToolbarButton icon={Search} label="Найти и заменить (Ctrl+F)" onClick={() => setFindReplaceOpen(true)} />
      </ToolbarGroup>

      <Separator orientation="vertical" className="h-6" />

      {/* Tools group */}
      <ToolbarGroup>
        <ToolbarButton icon={Code2} label="Редактор макросов" onClick={() => { setSidebarOpen(true); setSidebarTab('macros'); setMacroEditorOpen(true) }} />
        <ToolbarButton icon={BarChart3} label="Анализ данных" onClick={() => { setSidebarOpen(true); setSidebarTab('analysis') }} />
      </ToolbarGroup>
    </div>
  )
}