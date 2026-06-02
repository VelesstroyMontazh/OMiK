import { create } from 'zustand'

export interface CellStyle {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  fontFamily?: string
  fontSize?: number
  textColor?: string
  backgroundColor?: string
  alignment?: 'left' | 'center' | 'right'
  verticalAlignment?: 'top' | 'middle' | 'bottom'
  wrapText?: boolean
}

export interface CellData {
  value: string | number | null
  formula?: string
  style?: CellStyle
  numberFormat?: string
}

export interface MergedCell {
  startRow: number
  startCol: number
  endRow: number
  endCol: number
}

export interface Sheet {
  name: string
  data: Record<string, CellData>
  mergedCells: MergedCell[]
  columnWidths: Record<number, number>
  rowHeights: Record<number, number>
  defaultColumnWidth: number
  defaultRowHeight: number
}

export interface FileInfo {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  size: number
  filePath?: string
  sheets?: string[]
  extension?: string
}

export interface ClipboardData {
  cells: Array<{ row: number; col: number; data: CellData }>
  cut: boolean
  sourceRange: { startRow: number; startCol: number; endRow: number; endCol: number }
}

export type NumberFormat = 'general' | 'number' | 'currency' | 'percentage' | 'date' | 'time'

export interface SelectionRange {
  startRow: number
  startCol: number
  endRow: number
  endCol: number
}

export interface Macro {
  id: string
  name: string
  language: 'vba' | 'python'
  code: string
  createdAt: number
  updatedAt: number
}

interface ExcelState {
  // File state
  activeFile: FileInfo | null
  /** Предыдущие экраны (модули / файлы) для кнопки «Назад». */
  navHistory: FileInfo[]
  files: FileInfo[]
  currentFilePath: string | null

  // Loading / error state
  isLoading: boolean
  isUploading: boolean
  uploadProgress: number
  error: string | null
  backendAvailable: boolean

  // Sheet state
  sheets: Sheet[]
  activeSheetIndex: number

  // Selection state
  selectedCell: { row: number; col: number } | null
  selectedRange: SelectionRange | null
  selectionAnchor: { row: number; col: number } | null

  // Editing state
  isEditing: boolean
  editValue: string

  // Clipboard
  clipboard: ClipboardData | null

  // UI state
  sidebarOpen: boolean
  sidebarTab: 'files' | 'macros' | 'analysis'
  findReplaceOpen: boolean
  macroEditorOpen: boolean
  contextMenuPosition: { x: number; y: number; row: number; col: number } | null

  // Macros
  macros: Macro[]

  // Undo/Redo
  undoStack: Array<{ sheetIndex: number; changes: Record<string, CellData | null> }>
  redoStack: Array<{ sheetIndex: number; changes: Record<string, CellData | null> }>

  // Pending backend changes
  pendingChanges: Array<{ row: number; col: number; value: string }>

  // Actions
  setActiveFile: (file: FileInfo | null) => void
  /** Открыть экран с запоминанием текущего в истории. */
  navigateTo: (file: FileInfo | null) => void
  /** Вернуться на предыдущий экран (или на главную, если история пуста). */
  goBack: () => void
  /** Сохранить текущий экран в истории перед сменой состояния (редактор таблицы). */
  pushNavHistory: () => void
  setFiles: (files: FileInfo[]) => void
  setCurrentFilePath: (path: string | null) => void
  setIsLoading: (loading: boolean) => void
  setIsUploading: (uploading: boolean) => void
  setUploadProgress: (progress: number) => void
  setError: (error: string | null) => void
  setBackendAvailable: (available: boolean) => void
  setActiveSheet: (index: number) => void
  addSheet: (name?: string) => void
  deleteSheet: (index: number) => void
  renameSheet: (index: number, name: string) => void
  getCellValue: (row: number, col: number) => CellData | null
  setCellValue: (row: number, col: number, value: string, formula?: string) => void
  setCellStyle: (row: number, col: number, style: Partial<CellStyle>) => void
  setRangeStyle: (range: SelectionRange, style: Partial<CellStyle>) => void
  setSelectedCell: (row: number, col: number) => void
  setSelectedRange: (range: SelectionRange | null) => void
  setSelectionAnchor: (anchor: { row: number; col: number } | null) => void
  startEditing: (initialValue?: string) => void
  stopEditing: (confirm: boolean) => void
  setEditValue: (value: string) => void
  copySelection: () => void
  cutSelection: () => void
  pasteSelection: () => void
  setColumnWidth: (col: number, width: number) => void
  setRowHeight: (row: number, height: number) => void
  insertRow: (row: number) => void
  insertColumn: (col: number) => void
  deleteRow: (row: number) => void
  deleteColumn: (col: number) => void
  setSidebarOpen: (open: boolean) => void
  setSidebarTab: (tab: 'files' | 'macros' | 'analysis') => void
  setFindReplaceOpen: (open: boolean) => void
  setMacroEditorOpen: (open: boolean) => void
  setContextMenuPosition: (pos: { x: number; y: number; row: number; col: number } | null) => void
  addMacro: (macro: Macro) => void
  updateMacro: (id: string, updates: Partial<Macro>) => void
  deleteMacro: (id: string) => void
  loadSheetData: (data: unknown[][]) => void
  loadApiSheetData: (data: Array<Array<{ row: number; col: number; value: unknown; type: string }>>) => void
  mergeCells: (range: SelectionRange) => void
  unmergeCells: (range: SelectionRange) => void
  undo: () => void
  redo: () => void
  setNumberFormat: (range: SelectionRange, format: NumberFormat) => void
  addPendingChange: (row: number, col: number, value: string) => void
  clearPendingChanges: () => void
  resetToEmpty: () => void
}

const DEFAULT_COL_WIDTH = 100
const DEFAULT_ROW_HEIGHT = 24

function createEmptySheet(name: string): Sheet {
  return {
    name,
    data: {},
    mergedCells: [],
    columnWidths: {},
    rowHeights: {},
    defaultColumnWidth: DEFAULT_COL_WIDTH,
    defaultRowHeight: DEFAULT_ROW_HEIGHT,
  }
}

function cellKey(row: number, col: number): string {
  return `${row},${col}`
}

export function colToLetter(col: number): string {
  let result = ''
  let c = col
  while (c >= 0) {
    result = String.fromCharCode((c % 26) + 65) + result
    c = Math.floor(c / 26) - 1
  }
  return result
}

export function letterToCol(letters: string): number {
  let result = 0
  for (let i = 0; i < letters.length; i++) {
    result = result * 26 + (letters.charCodeAt(i) - 64)
  }
  return result - 1
}

export function cellRef(row: number, col: number): string {
  return `${colToLetter(col)}${row + 1}`
}

export const useExcelStore = create<ExcelState>((set, get) => ({
  // File state
  activeFile: null,
  navHistory: [],
  files: [],
  currentFilePath: null,

  // Loading / error state
  isLoading: false,
  isUploading: false,
  uploadProgress: 0,
  error: null,
  backendAvailable: false,

  // Sheet state
  sheets: [createEmptySheet('Лист1')],
  activeSheetIndex: 0,

  // Selection state
  selectedCell: { row: 0, col: 0 },
  selectedRange: null,
  selectionAnchor: null,

  // Editing state
  isEditing: false,
  editValue: '',

  // Clipboard
  clipboard: null,

  // UI state
  sidebarOpen: false,
  sidebarTab: 'files',
  findReplaceOpen: false,
  macroEditorOpen: false,
  contextMenuPosition: null,

  // Macros
  macros: [],

  // Undo/Redo
  undoStack: [],
  redoStack: [],

  // Pending backend changes
  pendingChanges: [],

  // Actions
  setActiveFile: (file) => set({ activeFile: file }),
  navigateTo: (file) => {
    const { activeFile, navHistory } = get()
    if (activeFile?.id === file?.id) return
    set({
      activeFile: file,
      navHistory: activeFile != null ? [...navHistory, activeFile] : navHistory,
    })
  },
  goBack: () => {
    const { navHistory } = get()
    if (navHistory.length === 0) {
      set({ activeFile: null })
      return
    }
    const prev = navHistory[navHistory.length - 1]!
    set({
      activeFile: prev,
      navHistory: navHistory.slice(0, -1),
    })
  },
  pushNavHistory: () => {
    const { activeFile, navHistory } = get()
    if (!activeFile) return
    if (navHistory[navHistory.length - 1]?.id === activeFile.id) return
    set({ navHistory: [...navHistory, activeFile] })
  },
  setFiles: (files) => set({ files }),
  setCurrentFilePath: (path) => set({ currentFilePath: path }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setIsUploading: (uploading) => set({ isUploading: uploading }),
  setUploadProgress: (progress) => set({ uploadProgress: progress }),
  setError: (error) => set({ error }),
  setBackendAvailable: (available) => set({ backendAvailable: available }),

  setActiveSheet: (index) =>
    set((state) => {
      if (index < 0 || index >= state.sheets.length) return state
      return { activeSheetIndex: index, selectedCell: { row: 0, col: 0 }, selectedRange: null }
    }),

  addSheet: (name) =>
    set((state) => {
      const sheetName = name || `Лист${state.sheets.length + 1}`
      const newSheet = createEmptySheet(sheetName)
      return {
        sheets: [...state.sheets, newSheet],
        activeSheetIndex: state.sheets.length,
      }
    }),

  deleteSheet: (index) =>
    set((state) => {
      if (state.sheets.length <= 1) return state
      const newSheets = state.sheets.filter((_, i) => i !== index)
      const newActiveIndex = Math.min(state.activeSheetIndex, newSheets.length - 1)
      return { sheets: newSheets, activeSheetIndex: newActiveIndex }
    }),

  renameSheet: (index, name) =>
    set((state) => {
      const newSheets = [...state.sheets]
      newSheets[index] = { ...newSheets[index], name }
      return { sheets: newSheets }
    }),

  getCellValue: (row, col) => {
    const state = get()
    const sheet = state.sheets[state.activeSheetIndex]
    const key = cellKey(row, col)
    return sheet.data[key] || null
  },

  setCellValue: (row, col, value, formula) =>
    set((state) => {
      const newSheets = [...state.sheets]
      const sheet = { ...newSheets[state.activeSheetIndex] }
      const key = cellKey(row, col)
      const existingCell = sheet.data[key]
      const oldData = existingCell ? { ...existingCell } : null

      const newData = { ...existingCell }
      if (value === '' && !formula) {
        // Delete cell
        const { [key]: _, ...rest } = sheet.data
        sheet.data = rest
      } else {
        newData.value = value
        if (formula !== undefined) {
          newData.formula = formula
        }
        sheet.data = { ...sheet.data, [key]: newData }
      }
      newSheets[state.activeSheetIndex] = sheet

      const changes: Record<string, CellData | null> = {}
      changes[key] = oldData

      // Add to pending changes for backend sync
      const newPending = [...state.pendingChanges, { row, col, value }]

      return {
        sheets: newSheets,
        undoStack: [...state.undoStack.slice(-50), { sheetIndex: state.activeSheetIndex, changes }],
        redoStack: [],
        pendingChanges: newPending,
      }
    }),

  setCellStyle: (row, col, style) =>
    set((state) => {
      const newSheets = [...state.sheets]
      const sheet = { ...newSheets[state.activeSheetIndex] }
      const key = cellKey(row, col)
      const existingCell = sheet.data[key] || { value: null }

      sheet.data = {
        ...sheet.data,
        [key]: { ...existingCell, style: { ...existingCell.style, ...style } },
      }
      newSheets[state.activeSheetIndex] = sheet
      return { sheets: newSheets }
    }),

  setRangeStyle: (range, style) =>
    set((state) => {
      const newSheets = [...state.sheets]
      const sheet = { ...newSheets[state.activeSheetIndex] }
      const newData = { ...sheet.data }

      const startRow = Math.min(range.startRow, range.endRow)
      const endRow = Math.max(range.startRow, range.endRow)
      const startCol = Math.min(range.startCol, range.endCol)
      const endCol = Math.max(range.startCol, range.endCol)

      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          const key = cellKey(r, c)
          const existingCell = newData[key] || { value: null }
          newData[key] = { ...existingCell, style: { ...existingCell.style, ...style } }
        }
      }

      sheet.data = newData
      newSheets[state.activeSheetIndex] = sheet
      return { sheets: newSheets }
    }),

  setSelectedCell: (row, col) =>
    set({
      selectedCell: { row, col },
      selectedRange: null,
      selectionAnchor: { row, col },
    }),

  setSelectedRange: (range) => set({ selectedRange: range }),

  setSelectionAnchor: (anchor) => set({ selectionAnchor: anchor }),

  startEditing: (initialValue) =>
    set((state) => {
      if (!state.selectedCell) return state
      const cell = state.sheets[state.activeSheetIndex].data[cellKey(state.selectedCell.row, state.selectedCell.col)]
      const value = initialValue !== undefined ? initialValue : cell?.formula ? `=${cell.formula}` : String(cell?.value ?? '')
      return { isEditing: true, editValue: value }
    }),

  stopEditing: (confirm) =>
    set((state) => {
      if (!confirm || !state.selectedCell) {
        return { isEditing: false, editValue: '' }
      }
      const { row, col } = state.selectedCell
      let value = state.editValue
      let formula: string | undefined

      if (value.startsWith('=')) {
        formula = value.substring(1)
      }

      // We need to call setCellValue, but we're in a set callback
      // So we'll schedule it
      setTimeout(() => {
        get().setCellValue(row, col, value, formula)
      }, 0)

      return { isEditing: false, editValue: '' }
    }),

  setEditValue: (value) => set({ editValue: value }),

  copySelection: () =>
    set((state) => {
      const range = getSelectedRangeBounds(state)
      if (!range) return state

      const cells: ClipboardData['cells'] = []
      for (let r = range.startRow; r <= range.endRow; r++) {
        for (let c = range.startCol; c <= range.endCol; c++) {
          const key = cellKey(r, c)
          const data = state.sheets[state.activeSheetIndex].data[key]
          if (data) {
            cells.push({ row: r, col: c, data: { ...data } })
          }
        }
      }

      return {
        clipboard: { cells, cut: false, sourceRange: range },
      }
    }),

  cutSelection: () =>
    set((state) => {
      const range = getSelectedRangeBounds(state)
      if (!range) return state

      const cells: ClipboardData['cells'] = []
      for (let r = range.startRow; r <= range.endRow; r++) {
        for (let c = range.startCol; c <= range.endCol; c++) {
          const key = cellKey(r, c)
          const data = state.sheets[state.activeSheetIndex].data[key]
          if (data) {
            cells.push({ row: r, col: c, data: { ...data } })
          }
        }
      }

      return {
        clipboard: { cells, cut: true, sourceRange: range },
      }
    }),

  pasteSelection: () =>
    set((state) => {
      if (!state.clipboard || !state.selectedCell) return state

      const { cells, cut, sourceRange } = state.clipboard
      const { row: targetRow, col: targetCol } = state.selectedCell
      const rowOffset = targetRow - sourceRange.startRow
      const colOffset = targetCol - sourceRange.startCol

      const newSheets = [...state.sheets]
      const sheet = { ...newSheets[state.activeSheetIndex] }
      const newData = { ...sheet.data }

      // Paste cells
      for (const cell of cells) {
        const newRow = cell.row + rowOffset
        const newCol = cell.col + colOffset
        const newKey = cellKey(newRow, newCol)
        newData[newKey] = { ...cell.data }
      }

      // If cut, remove source cells
      if (cut) {
        for (const cell of cells) {
          const oldKey = cellKey(cell.row, cell.col)
          delete newData[oldKey]
        }
      }

      sheet.data = newData
      newSheets[state.activeSheetIndex] = sheet

      return {
        sheets: newSheets,
        clipboard: cut ? null : state.clipboard,
      }
    }),

  setColumnWidth: (col, width) =>
    set((state) => {
      const newSheets = [...state.sheets]
      const sheet = { ...newSheets[state.activeSheetIndex] }
      sheet.columnWidths = { ...sheet.columnWidths, [col]: width }
      newSheets[state.activeSheetIndex] = sheet
      return { sheets: newSheets }
    }),

  setRowHeight: (row, height) =>
    set((state) => {
      const newSheets = [...state.sheets]
      const sheet = { ...newSheets[state.activeSheetIndex] }
      sheet.rowHeights = { ...sheet.rowHeights, [row]: height }
      newSheets[state.activeSheetIndex] = sheet
      return { sheets: newSheets }
    }),

  insertRow: (row) =>
    set((state) => {
      const newSheets = [...state.sheets]
      const sheet = { ...newSheets[state.activeSheetIndex] }
      const newData: Record<string, CellData> = {}

      // Shift all cells at row >= row down by 1
      for (const [key, cell] of Object.entries(sheet.data)) {
        const [r, c] = key.split(',').map(Number)
        if (r >= row) {
          newData[cellKey(r + 1, c)] = cell
        } else {
          newData[key] = cell
        }
      }

      sheet.data = newData
      newSheets[state.activeSheetIndex] = sheet
      return { sheets: newSheets }
    }),

  insertColumn: (col) =>
    set((state) => {
      const newSheets = [...state.sheets]
      const sheet = { ...newSheets[state.activeSheetIndex] }
      const newData: Record<string, CellData> = {}

      for (const [key, cell] of Object.entries(sheet.data)) {
        const [r, c] = key.split(',').map(Number)
        if (c >= col) {
          newData[cellKey(r, c + 1)] = cell
        } else {
          newData[key] = cell
        }
      }

      sheet.data = newData
      newSheets[state.activeSheetIndex] = sheet
      return { sheets: newSheets }
    }),

  deleteRow: (row) =>
    set((state) => {
      const newSheets = [...state.sheets]
      const sheet = { ...newSheets[state.activeSheetIndex] }
      const newData: Record<string, CellData> = {}

      for (const [key, cell] of Object.entries(sheet.data)) {
        const [r, c] = key.split(',').map(Number)
        if (r === row) continue
        if (r > row) {
          newData[cellKey(r - 1, c)] = cell
        } else {
          newData[key] = cell
        }
      }

      sheet.data = newData
      newSheets[state.activeSheetIndex] = sheet
      return { sheets: newSheets }
    }),

  deleteColumn: (col) =>
    set((state) => {
      const newSheets = [...state.sheets]
      const sheet = { ...newSheets[state.activeSheetIndex] }
      const newData: Record<string, CellData> = {}

      for (const [key, cell] of Object.entries(sheet.data)) {
        const [r, c] = key.split(',').map(Number)
        if (c === col) continue
        if (c > col) {
          newData[cellKey(r, c - 1)] = cell
        } else {
          newData[key] = cell
        }
      }

      sheet.data = newData
      newSheets[state.activeSheetIndex] = sheet
      return { sheets: newSheets }
    }),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  setFindReplaceOpen: (open) => set({ findReplaceOpen: open }),
  setMacroEditorOpen: (open) => set({ macroEditorOpen: open }),
  setContextMenuPosition: (pos) => set({ contextMenuPosition: pos }),

  addMacro: (macro) => set((state) => ({ macros: [...state.macros, macro] })),
  updateMacro: (id, updates) =>
    set((state) => ({
      macros: state.macros.map((m) => (m.id === id ? { ...m, ...updates, updatedAt: Date.now() } : m)),
    })),
  deleteMacro: (id) => set((state) => ({ macros: state.macros.filter((m) => m.id !== id) })),

  loadSheetData: (data) =>
    set((state) => {
      const newSheets = [...state.sheets]
      const sheet = { ...newSheets[state.activeSheetIndex] }
      const newData: Record<string, CellData> = {}

      data.forEach((row, rowIndex) => {
        if (Array.isArray(row)) {
          row.forEach((cell, colIndex) => {
            if (cell !== null && cell !== undefined && cell !== '') {
              newData[cellKey(rowIndex, colIndex)] = { value: String(cell) }
            }
          })
        }
      })

      sheet.data = newData
      newSheets[state.activeSheetIndex] = sheet
      return { sheets: newSheets }
    }),

  loadApiSheetData: (data) =>
    set((state) => {
      const newSheets = [...state.sheets]
      const sheet = { ...newSheets[state.activeSheetIndex] }
      const newData: Record<string, CellData> = {}

      data.forEach((row) => {
        if (Array.isArray(row)) {
          row.forEach((cell) => {
            if (cell && cell.row !== undefined && cell.col !== undefined) {
              // API returns 1-indexed row/col, store uses 0-indexed
              const r = cell.row - 1
              const c = cell.col - 1
              const value = cell.value
              if (value !== null && value !== undefined) {
                newData[cellKey(r, c)] = { value: String(value) }
              }
            }
          })
        }
      })

      sheet.data = newData
      newSheets[state.activeSheetIndex] = sheet
      return { sheets: newSheets, pendingChanges: [] }
    }),

  mergeCells: (range) =>
    set((state) => {
      const newSheets = [...state.sheets]
      const sheet = { ...newSheets[state.activeSheetIndex] }
      sheet.mergedCells = [
        ...sheet.mergedCells,
        {
          startRow: Math.min(range.startRow, range.endRow),
          startCol: Math.min(range.startCol, range.endCol),
          endRow: Math.max(range.startRow, range.endRow),
          endCol: Math.max(range.startCol, range.endCol),
        },
      ]
      newSheets[state.activeSheetIndex] = sheet
      return { sheets: newSheets }
    }),

  unmergeCells: (range) =>
    set((state) => {
      const newSheets = [...state.sheets]
      const sheet = { ...newSheets[state.activeSheetIndex] }
      const sr = Math.min(range.startRow, range.endRow)
      const er = Math.max(range.startRow, range.endRow)
      const sc = Math.min(range.startCol, range.endCol)
      const ec = Math.max(range.startCol, range.endCol)

      sheet.mergedCells = sheet.mergedCells.filter(
        (m) => !(m.startRow === sr && m.endRow === er && m.startCol === sc && m.endCol === ec)
      )
      newSheets[state.activeSheetIndex] = sheet
      return { sheets: newSheets }
    }),

  undo: () =>
    set((state) => {
      if (state.undoStack.length === 0) return state
      const lastUndo = state.undoStack[state.undoStack.length - 1]
      const newSheets = [...state.sheets]
      const sheet = { ...newSheets[lastUndo.sheetIndex] }
      const newData = { ...sheet.data }

      // Record current state for redo
      const redoChanges: Record<string, CellData | null> = {}
      for (const key of Object.keys(lastUndo.changes)) {
        redoChanges[key] = newData[key] || null
      }

      // Apply undo
      for (const [key, data] of Object.entries(lastUndo.changes)) {
        if (data === null) {
          delete newData[key]
        } else {
          newData[key] = data
        }
      }

      sheet.data = newData
      newSheets[lastUndo.sheetIndex] = sheet

      return {
        sheets: newSheets,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, { sheetIndex: lastUndo.sheetIndex, changes: redoChanges }],
      }
    }),

  redo: () =>
    set((state) => {
      if (state.redoStack.length === 0) return state
      const lastRedo = state.redoStack[state.redoStack.length - 1]
      const newSheets = [...state.sheets]
      const sheet = { ...newSheets[lastRedo.sheetIndex] }
      const newData = { ...sheet.data }

      const undoChanges: Record<string, CellData | null> = {}
      for (const key of Object.keys(lastRedo.changes)) {
        undoChanges[key] = newData[key] || null
      }

      for (const [key, data] of Object.entries(lastRedo.changes)) {
        if (data === null) {
          delete newData[key]
        } else {
          newData[key] = data
        }
      }

      sheet.data = newData
      newSheets[lastRedo.sheetIndex] = sheet

      return {
        sheets: newSheets,
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [...state.undoStack, { sheetIndex: lastRedo.sheetIndex, changes: undoChanges }],
      }
    }),

  setNumberFormat: (range, format) =>
    set((state) => {
      const newSheets = [...state.sheets]
      const sheet = { ...newSheets[state.activeSheetIndex] }
      const newData = { ...sheet.data }

      const startRow = Math.min(range.startRow, range.endRow)
      const endRow = Math.max(range.startRow, range.endRow)
      const startCol = Math.min(range.startCol, range.endCol)
      const endCol = Math.max(range.startCol, range.endCol)

      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          const key = cellKey(r, c)
          const existingCell = newData[key] || { value: null }
          newData[key] = { ...existingCell, numberFormat: format }
        }
      }

      sheet.data = newData
      newSheets[state.activeSheetIndex] = sheet
      return { sheets: newSheets }
    }),

  addPendingChange: (row, col, value) =>
    set((state) => ({
      pendingChanges: [...state.pendingChanges, { row, col, value }],
    })),

  clearPendingChanges: () => set({ pendingChanges: [] }),

  resetToEmpty: () =>
    set({
      activeFile: null,
      navHistory: [],
      currentFilePath: null,
      sheets: [createEmptySheet('Лист1')],
      activeSheetIndex: 0,
      selectedCell: { row: 0, col: 0 },
      selectedRange: null,
      selectionAnchor: null,
      isEditing: false,
      editValue: '',
      undoStack: [],
      redoStack: [],
      pendingChanges: [],
      error: null,
    }),
}))

// Add a selector helper
export function getSelectedRangeBounds(state: ExcelState): SelectionRange | null {
  if (state.selectedRange) {
    return {
      startRow: Math.min(state.selectedRange.startRow, state.selectedRange.endRow),
      startCol: Math.min(state.selectedRange.startCol, state.selectedRange.endCol),
      endRow: Math.max(state.selectedRange.startRow, state.selectedRange.endRow),
      endCol: Math.max(state.selectedRange.startCol, state.selectedRange.endCol),
    }
  }
  if (state.selectedCell) {
    return {
      startRow: state.selectedCell.row,
      startCol: state.selectedCell.col,
      endRow: state.selectedCell.row,
      endCol: state.selectedCell.col,
    }
  }
  return null
}