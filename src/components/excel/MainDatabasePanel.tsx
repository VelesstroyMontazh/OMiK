'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMainDbStore, type MainDbStatus } from '@/store/main-db-store'
import { useExcelApi } from '@/hooks/use-excel-api'
import { Button } from '@/components/ui/button'
import {
  Search,
  Database,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronFirst,
  ChevronLast,
  RefreshCw,
  Key,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileSpreadsheet,
  ToggleLeft,
  ToggleRight,
  BarChart3,
} from 'lucide-react'
import ColumnHeaderFilter from '@/components/excel/ColumnHeaderFilter'
import TableEditButton from '@/components/excel/TableEditButton'
import ExportToExcelButton from '@/components/excel/ExportToExcelButton'
import ReportsPanel from '@/components/excel/ReportsPanel'
import { useColumnFilters } from '@/hooks/useColumnFilters'

const PAGE_SIZE = 500
/** Верхняя граница «Загрузить все строки» (вся активная база на одной странице) */
const PAGE_SIZE_MAX = 250_000
const DATE_COLUMNS = new Set([
  'Дата приема',
  'Дата увольнения',
  'Дата рождения',
  'Удостоверение.Дата выдачи',
])

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function formatRuDate(y: number, m: number, d: number): string {
  return `${pad2(d)}.${pad2(m)}.${y}`
}

function formatExcelSerialDate(serial: number): string | null {
  if (!Number.isFinite(serial)) return null
  const whole = Math.floor(serial)
  if (whole <= 0) return null
  const baseUtcMs = Date.UTC(1899, 11, 30)
  const d = new Date(baseUtcMs + whole * 86_400_000)
  if (Number.isNaN(d.getTime())) return null
  return formatRuDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

function formatMainDbCellValue(column: string, value: unknown): string {
  if (value === null || value === undefined) return ''
  const raw = String(value).trim()
  if (!DATE_COLUMNS.has(column)) return raw
  if (!raw) return ''

  const dmY = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/)
  if (dmY) {
    const d = Number(dmY[1])
    const m = Number(dmY[2])
    const y = Number(dmY[3])
    return formatRuDate(y, m, d)
  }

  const yMd = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/)
  if (yMd) {
    const y = Number(yMd[1])
    const m = Number(yMd[2])
    const d = Number(yMd[3])
    return formatRuDate(y, m, d)
  }

  const asNumber = Number(raw.replace(',', '.'))
  if (!Number.isNaN(asNumber) && raw !== '') {
    const serialDate = formatExcelSerialDate(asNumber)
    if (serialDate) return serialDate
  }

  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) {
    return formatRuDate(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate())
  }

  return raw
}

function formatLoadedAt(iso?: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('ru-RU')
  } catch {
    return String(iso)
  }
}

function activeFileLabel(status: MainDbStatus | null): string {
  if (!status) return '—'
  const name = (status as { file_name?: string }).file_name
  if (name) return name
  const src = status.source_excel || status.file_path
  if (!src) return '—'
  const parts = src.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || src
}

// Column short labels for filter chips
function getColumnShortLabel(colName: string): string {
  const map: Record<string, string> = {
    'Табельный номер (с префиксами)': 'Таб. номер',
    'ФИО': 'ФИО',
    'Удостоверение.Серия': 'Серия',
    'Удостоверение.Номер': 'Номер',
    'Организация': 'Организация',
    'Подразделение': 'Подразделение',
    'Должность': 'Должность',
    'Разряд (категория)': 'Разряд',
    'Состояние': 'Состояние',
    'График работы': 'График',
    'Дата приема': 'Дата приема',
    'Дата увольнения': 'Дата увольн.',
    'Страна гражданства': 'Страна',
    'Территория': 'Территория',
    'Дата рождения': 'Дата рожд.',
    'Сотрудник.Дата выхода на работу (Сотрудники)': 'Дата выхода',
    'Место рождения': 'Место рожд.',
    'Удостоверение.Кем выдан': 'Кем выдан',
    'Удостоверение.Дата выдачи': 'Дата выдачи',
    'Физическое лицо.Адрес по прописке': 'Адрес',
    'Физическое лицо.Домашний телефон': 'Тел. дом.',
    'Физическое лицо.Личный мобильный телефон': 'Тел. моб.',
    'Физическое лицо.Рабочий телефон': 'Тел. раб.',
    'Итого': 'Площадка',
    'Площадка': 'Площадка',
    'Статус': 'Статус',
  }
  return map[colName] || colName.substring(0, 15)
}

export default function MainDatabasePanel() {
  const api = useExcelApi()
  const status = useMainDbStore((s) => s.status)
  const columns = useMainDbStore((s) => s.columns)
  const data = useMainDbStore((s) => s.data)
  const totalRows = useMainDbStore((s) => s.totalRows)
  const totalUnfilteredRows = useMainDbStore((s) => s.totalUnfilteredRows)
  const offset = useMainDbStore((s) => s.offset)
  const hasMore = useMainDbStore((s) => s.hasMore)
  const displayedColumns = useMainDbStore((s) => s.displayedColumns)
  const searchQuery = useMainDbStore((s) => s.searchQuery)
  const filters = useMainDbStore((s) => s.filters)
  const sortColumn = useMainDbStore((s) => s.sortColumn)
  const sortAscending = useMainDbStore((s) => s.sortAscending)
  const keyColumnsOnly = useMainDbStore((s) => s.keyColumnsOnly)
  const isLoadingData = useMainDbStore((s) => s.isLoadingData)
  const isLoaded = useMainDbStore((s) => s.isLoaded)
  const isLoadingDb = useMainDbStore((s) => s.isLoadingDb)

  const [localSearch, setLocalSearch] = useState(searchQuery)
  const [selectedRow, setSelectedRow] = useState<number | null>(null)
  const [activeView, setActiveView] = useState<'data' | 'reports'>('data')
  const [rowsPerPage, setRowsPerPage] = useState(PAGE_SIZE)
  const [loadAllMode, setLoadAllMode] = useState(false)
  const [loadingAllRows, setLoadingAllRows] = useState(false)
  const [reloadingDb, setReloadingDb] = useState(false)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  // Только статус и уже собранная SQLite — без автозагрузки из «случайного» Excel
  useEffect(() => {
    const initMainDb = async () => {
      try {
        useMainDbStore.getState().setIsLoadingDb(true)
        const statusResult = (await api.mainDbStatus()) as MainDbStatus
        useMainDbStore.getState().setStatus(statusResult)

        if (!statusResult.loaded) {
          return
        }

        const [columnsResult, dataResult] = await Promise.all([
          api.mainDbColumns(),
          api.mainDbData({ offset: 0, limit: PAGE_SIZE }),
        ])
        useMainDbStore.getState().setColumns(columnsResult.columns || [])
        useMainDbStore.getState().setData(
          dataResult.data || [],
          dataResult.total_rows || 0,
          dataResult.total_unfiltered_rows || 0,
          0,
          dataResult.has_more || false,
          dataResult.columns || [],
        )
      } catch (err) {
        console.error('Failed to load main DB:', err)
      } finally {
        useMainDbStore.getState().setIsLoadingDb(false)
      }
    }
    initMainDb()
  }, [api])

  const fullTableLimit = useCallback(() => {
    const store = useMainDbStore.getState()
    const total = store.totalUnfilteredRows || status?.row_count || PAGE_SIZE_MAX
    return Math.min(Math.max(total, 1), PAGE_SIZE_MAX)
  }, [status?.row_count])

  const fetchData = useCallback(async (newOffset?: number, limitOverride?: number) => {
    const store = useMainDbStore.getState()
    const actualOffset = newOffset !== undefined ? newOffset : store.offset
    const limit = loadAllMode ? fullTableLimit() : (limitOverride ?? rowsPerPage)
    store.setIsLoadingData(true)
    try {
      const result = await api.mainDbData({
        offset: actualOffset,
        limit,
        search: store.searchQuery || undefined,
        filters: Object.keys(store.filters).length > 0 ? store.filters : undefined,
        sort_column: store.sortColumn || undefined,
        sort_ascending: store.sortAscending,
        key_columns_only: store.keyColumnsOnly,
      })
      store.setData(
        result.data || [],
        result.total_rows || 0,
        result.total_unfiltered_rows || 0,
        actualOffset,
        result.has_more || false,
        result.columns || []
      )
    } catch (err) {
      console.error('Failed to fetch data:', err)
    } finally {
      store.setIsLoadingData(false)
    }
  }, [api, rowsPerPage, loadAllMode, fullTableLimit])

  const handleLoadAllRows = useCallback(async () => {
    const cap = fullTableLimit()
    if (loadAllMode && rowsPerPage >= cap) return
    setLoadingAllRows(true)
    setLoadAllMode(true)
    setRowsPerPage(cap)
    useMainDbStore.getState().setOffset(0)
    try {
      await fetchData(0, cap)
    } finally {
      setLoadingAllRows(false)
    }
  }, [fetchData, fullTableLimit, loadAllMode, rowsPerPage])

  const handleExitLoadAllMode = useCallback(() => {
    setLoadAllMode(false)
    setRowsPerPage(PAGE_SIZE)
    useMainDbStore.getState().setOffset(0)
    void fetchData(0, PAGE_SIZE)
  }, [fetchData])

  const handleReloadFromExcel = useCallback(async () => {
    const filePath = status?.file_path
    if (!filePath) return
    setReloadingDb(true)
    try {
      await api.mainDbLoad(filePath, {
        forceReload: true,
        sheetName: status?.sheet_name ?? undefined,
      })
      const statusResult = (await api.mainDbStatus()) as MainDbStatus
      useMainDbStore.getState().setStatus(statusResult)
      await fetchData(0)
    } catch (err) {
      console.error('Failed to reload main DB from Excel:', err)
    } finally {
      setReloadingDb(false)
    }
  }, [api, fetchData, status?.file_path, status?.sheet_name])

  const handleSearch = useCallback((value: string) => {
    setLocalSearch(value)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => {
      useMainDbStore.getState().setSearchQuery(value)
      fetchData(0)
    }, 500)
  }, [fetchData])

  const handleSort = useCallback((colName: string) => {
    const store = useMainDbStore.getState()
    if (store.sortColumn === colName) {
      store.setSortAscending(!store.sortAscending)
    } else {
      store.setSortColumn(colName)
      store.setSortAscending(true)
    }
    fetchData(0)
  }, [fetchData])

  const handlePageChange = useCallback((newOffset: number) => {
    useMainDbStore.getState().setOffset(newOffset)
    fetchData(newOffset)
    gridRef.current?.scrollTo(0, 0)
  }, [fetchData])

  const handleToggleKeyColumns = useCallback(() => {
    const newVal = !keyColumnsOnly
    useMainDbStore.getState().setKeyColumnsOnly(newVal)
    fetchData(0)
  }, [keyColumnsOnly, fetchData])

  const handleRefresh = useCallback(() => {
    fetchData()
  }, [fetchData])

  const handleClearFilters = useCallback(() => {
    useMainDbStore.getState().clearFilters()
    setLocalSearch('')
    fetchData(0)
  }, [fetchData])

  const keyColumnSet = useMemo(() => new Set(columns.filter(c => c.is_key).map(c => c.name)), [columns])
  const currentPage = Math.floor(offset / rowsPerPage) + 1
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage))

  const tableRows = useMemo(
    () =>
      data.map((row) => {
        const o: Record<string, unknown> = {}
        for (const cell of row) o[cell.column] = formatMainDbCellValue(cell.column, cell.value)
        return o
      }),
    [data],
  )

  const colFilters = useColumnFilters(
    tableRows,
    displayedColumns,
    undefined,
    loadAllMode ? 8_000 : 200,
  )

  const visibleData = useMemo(() => {
    const allowed = new Set(colFilters.filteredRows)
    return data.filter((_, i) => allowed.has(tableRows[i]))
  }, [data, tableRows, colFilters.filteredRows])

  const editColumns = useMemo(
    () => displayedColumns.map((name) => ({ key: name, title: getColumnShortLabel(name) })),
    [displayedColumns],
  )

  useEffect(() => {
    if (!colFilters.openFilterCol) return
    const close = () => colFilters.setOpenFilterCol(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [colFilters.openFilterCol, colFilters.setOpenFilterCol, colFilters])

  // Loading state
  if (isLoadingDb) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-amber-600 mx-auto mb-4" />
          <p className="text-lg font-semibold text-amber-800">Загрузка Основной Базы Данных...</p>
          <p className="text-sm text-amber-600 mt-1">112 000+ записей сотрудников</p>
        </div>
      </div>
    )
  }

  if (!isLoaded || !status?.loaded) {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-gradient-to-br from-amber-50 to-orange-50">
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white px-4 py-3 flex flex-wrap items-center gap-2 shrink-0">
          <Database className="h-5 w-5" />
          <span className="text-sm font-bold flex-1">Основная База Данных</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-lg">
            <Database className="h-14 w-14 text-amber-500 mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-800">Активная база не выбрана</p>
            <p className="text-sm text-gray-600 mt-2">
              Откройте <strong>Настройки</strong> на главном экране → вкладка <strong>БАЗА</strong>,
              загрузите файл и нажмите <strong>Задействовать</strong>.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white">
      {/* Header bar */}
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white px-4 py-2 flex items-center gap-3 flex-shrink-0 shadow-sm">
        <Database className="h-5 w-5" />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold">Основная База Данных — Сотрудники</h2>
          <p className="text-[10px] text-amber-100 truncate">
            {activeFileLabel(status)} • Загружено: {formatLoadedAt(status?.loaded_at)}
          </p>
          <p className="text-[10px] text-amber-200/90">
            {totalUnfilteredRows.toLocaleString('ru-RU')} сотрудников • {status.col_count} столбцов
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] text-white hover:bg-amber-700"
            onClick={() => setActiveView(activeView === 'data' ? 'reports' : 'data')}
          >
            <BarChart3 className="h-3.5 w-3.5 mr-1" />
            {activeView === 'data' ? 'Отчеты' : 'Данные'}
          </Button>
          {activeView === 'data' && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] text-white hover:bg-amber-700"
                disabled={loadingAllRows || (loadAllMode && rowsPerPage >= fullTableLimit())}
                onClick={() => void handleLoadAllRows()}
              >
                {loadingAllRows ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : null}
                Загрузить все строки
              </Button>
              {loadAllMode && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px] text-white hover:bg-amber-700"
                  onClick={() => handleExitLoadAllMode()}
                >
                  По {PAGE_SIZE} на стр.
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] text-white hover:bg-amber-700"
                disabled={reloadingDb}
                onClick={() => void handleReloadFromExcel()}
              >
                {reloadingDb ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                )}
                Обновить из Excel
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] text-white hover:bg-amber-700"
                onClick={handleToggleKeyColumns}
              >
                {keyColumnsOnly ? <ToggleRight className="h-4 w-4 mr-1" /> : <ToggleLeft className="h-4 w-4 mr-1" />}
                {keyColumnsOnly ? 'Все столбцы' : 'Ключевые'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] text-white hover:bg-amber-700"
                onClick={handleRefresh}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Reports View */}
      {activeView === 'reports' && <ReportsPanel />}

      {/* Data View */}
      {activeView === 'data' && (<>

      <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 shrink-0">
        <p className="text-xs text-amber-900">
          <span className="font-semibold">{activeFileLabel(status)}</span>
          <span className="text-amber-700"> — Загружено: {formatLoadedAt(status?.loaded_at)}</span>
        </p>
      </div>

      <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 shrink-0">
        <p className="text-xs text-amber-900">
          <span className="font-semibold">{activeFileLabel(status)}</span>
          <span className="text-amber-700"> — Загружено: {formatLoadedAt(status?.loaded_at)}</span>
        </p>
      </div>

      {/* Search & Filter bar */}
      <div className="border-b border-gray-200 px-4 py-2 flex items-center gap-3 flex-shrink-0 bg-gray-50">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по всем столбцам..."
            className="w-full h-8 pl-8 pr-8 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
            value={localSearch}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {localSearch && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onClick={() => handleSearch('')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Active filters */}
        {Object.keys(filters).length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {Object.entries(filters).map(([col, val]) => (
              <span
                key={col}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[11px]"
              >
                <span className="font-medium">{getColumnShortLabel(col)}:</span> {val}
                <button onClick={() => { useMainDbStore.getState().removeFilter(col); fetchData(0) }}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <button
              className="text-[11px] text-gray-500 hover:text-gray-700 underline"
              onClick={handleClearFilters}
            >
              Сбросить
            </button>
          </div>
        )}

        {loadAllMode && (
          <span className="text-[11px] text-amber-800 font-medium">
            Все строки на странице ({data.length.toLocaleString('ru-RU')}) — фильтры по столбцам по всей загруженной базе
          </span>
        )}
        {loadAllMode && (
          <span className="text-[11px] text-amber-800 font-medium">
            Все строки на странице ({data.length.toLocaleString('ru-RU')}) — фильтры по столбцам по всей загруженной базе
          </span>
        )}
        {searchQuery && (
          <span className="text-[11px] text-gray-500">
            Найдено: {totalRows.toLocaleString('ru-RU')} из {totalUnfilteredRows.toLocaleString('ru-RU')}
          </span>
        )}
        <ExportToExcelButton
          fileName="Основная_База_страница"
          columns={editColumns}
          rows={colFilters.filteredRows}
        />
        <ExportToExcelButton
          fileName="Основная_База_страница"
          columns={editColumns}
          rows={colFilters.filteredRows}
        />
        <TableEditButton
          title="Основная БД — текущая страница"
          columns={editColumns}
          rows={colFilters.filteredRows}
        />
      </div>

      {/* Data Grid */}
      <div className="flex-1 min-h-0 overflow-auto" ref={gridRef}>
        {isLoadingData && (
          <div className="sticky top-0 z-10 bg-amber-50 border-b border-amber-200 px-3 py-1 text-xs text-amber-700 flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" /> Загрузка...
          </div>
        )}
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-gray-100">
            <tr>
              <th className="px-2 py-1.5 text-left text-[11px] font-semibold text-gray-500 border-b border-r border-gray-200 w-10 bg-gray-100">
                №
              </th>
              {displayedColumns.map((colName, idx) => {
                const isKey = keyColumnSet.has(colName)
                return (
                  <th
                    key={idx}
                    className={`px-2 py-1.5 text-left text-[11px] font-semibold border-b border-r border-gray-200 select-none whitespace-nowrap relative ${
                      isKey
                        ? 'bg-amber-50 text-amber-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        className="flex items-center gap-1 flex-1 min-w-0 cursor-pointer"
                        onClick={() => handleSort(colName)}
                      >
                        {isKey && <Key className="h-3 w-3 text-amber-500 flex-shrink-0" />}
                        <span className="truncate max-w-[120px]">{getColumnShortLabel(colName)}</span>
                        {sortColumn === colName && (
                          sortAscending
                            ? <ArrowUp className="h-3 w-3 text-amber-600 flex-shrink-0" />
                            : <ArrowDown className="h-3 w-3 text-amber-600 flex-shrink-0" />
                        )}
                        {sortColumn !== colName && (
                          <ArrowUpDown className="h-3 w-3 text-gray-300 flex-shrink-0" />
                        )}
                      </button>
                      <ColumnHeaderFilter
                        colKey={colName}
                        title=""
                        activeFilter={Boolean(colFilters.columnFilters[colName]?.size)}
                        isOpen={colFilters.openFilterCol === colName}
                        uniqueValues={colFilters.uniqueByColumn[colName] || []}
                        selected={colFilters.columnFilters[colName]}
                        onToggleOpen={colFilters.setOpenFilterCol}
                        onToggleValue={colFilters.toggleFilterValue}
                        onClear={colFilters.clearColFilter}
                        onSelectAll={colFilters.selectAllFilterValues}
                        onSelectNone={colFilters.selectNoneFilterValues}
                        variant="amber"
                        titleClassName="sr-only"
                      />
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {visibleData.map((row, rowIdx) => {
              const isSelected = selectedRow === rowIdx
              return (
                <tr
                  key={rowIdx}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-amber-100'
                      : rowIdx % 2 === 0
                        ? 'bg-white hover:bg-amber-50'
                        : 'bg-gray-50 hover:bg-amber-50'
                  }`}
                  onClick={() => setSelectedRow(isSelected ? null : rowIdx)}
                >
                  <td className="px-2 py-1 text-[11px] text-gray-400 border-b border-r border-gray-100 text-right">
                    {offset + rowIdx + 1}
                  </td>
                  {row.map((cell, cellIdx) => {
                    const isKey = keyColumnSet.has(cell.column)
                    const cellValue = formatMainDbCellValue(cell.column, cell.value)
                    return (
                      <td
                        key={cellIdx}
                        className={`px-2 py-1 text-[12px] border-b border-r border-gray-100 truncate max-w-[250px] ${
                          isKey
                            ? 'font-medium text-gray-900'
                            : 'text-gray-600'
                        }`}
                        title={cellValue}
                      >
                        {cellValue}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
            {data.length === 0 && (
              <tr>
                <td colSpan={displayedColumns.length + 1} className="text-center py-12 text-gray-400">
                  <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Данные не найдены</p>
                  {searchQuery && (
                    <p className="text-xs mt-1">Попробуйте изменить запрос поиска</p>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="text-[11px] text-gray-500">
          {loadAllMode ? (
            <>
              Загружено {data.length.toLocaleString('ru-RU')} из{' '}
              {totalUnfilteredRows.toLocaleString('ru-RU')} сотрудников
              {totalRows !== totalUnfilteredRows && (
                <span className="text-amber-600">
                  {' '}
                  (после поиска/фильтров сервера: {totalRows.toLocaleString('ru-RU')})
                </span>
              )}
            </>
          ) : (
            <>
              Стр. {currentPage} из {totalPages} • Записи {offset + 1}–
              {Math.min(offset + rowsPerPage, totalRows)} из {totalRows.toLocaleString('ru-RU')}
              {` • по ${rowsPerPage.toLocaleString('ru-RU')} на стр.`}
            </>
          )}
          {totalRows !== totalUnfilteredRows && (
            <span className="text-amber-600"> (фильтр: {totalRows.toLocaleString('ru-RU')} из {totalUnfilteredRows.toLocaleString('ru-RU')})</span>
          )}
        </div>
        <div className={`flex items-center gap-1 ${loadAllMode ? 'opacity-40 pointer-events-none' : ''}`}>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={loadAllMode || offset === 0}
            onClick={() => handlePageChange(0)}
          >
            <ChevronFirst className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={offset === 0}
            onClick={() => handlePageChange(Math.max(0, offset - rowsPerPage))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-[11px] text-gray-600 mx-2">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={!hasMore}
            onClick={() => handlePageChange(offset + rowsPerPage)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={!hasMore}
            onClick={() => handlePageChange((totalPages - 1) * rowsPerPage)}
          >
            <ChevronLast className="h-4 w-4" />
          </Button>
        </div>
      </div>
      </>)}
    </div>
  )
}
