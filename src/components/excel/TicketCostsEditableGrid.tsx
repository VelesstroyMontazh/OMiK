'use client'

import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import { useExcelApi } from '@/hooks/use-excel-api'
import { Button } from '@/components/ui/button'
import TicketCostsActionStatusBar from '@/components/excel/TicketCostsActionStatusBar'
import { useTicketCostsActionStatus } from '@/components/excel/useTicketCostsActionStatus'
import ColumnHeaderFilter from '@/components/excel/ColumnHeaderFilter'
import TableEditButton from '@/components/excel/TableEditButton'
import ExportToExcelButton from '@/components/excel/ExportToExcelButton'
import { cellText, useColumnFilters } from '@/hooks/useColumnFilters'
import { Loader2, Save, Search, Table2, X } from 'lucide-react'
import {
  buildTableFetchKey,
  filtersToApiParams,
  getTableCache,
  invalidateTicketCostsCache,
  setTableCache,
  type RegistryId,
  type TicketCostsColumnDef,
  type TicketCostsDataRow,
  type TicketCostsFilterState,
  getTableFetchAbortSignal,
} from '@/components/excel/ticketCostsCache'

const ROW_HEIGHT = 28
const VIEW_BUFFER = 8
/** Сколько строк подгружать в браузер за раз (полная таблица в SQLite — до totalRows). */
const TABLE_FETCH_LIMIT = 3000
const MONEY_KEYS = new Set(['summa_pokupka', 'summa_obmen', 'summa_vozvrat_sbor', 'summa_total'])
/** Выше — отключаем тяжёлые фильтры по уникальным значениям (скан всей таблицы). */
const HEAVY_TABLE_ROWS = 2500

type TableActionId =
  | 'clean_tab_passport'
  | 'enrich_passport'
  | 'enrich_fio_en'
  | 'enrich_fio_fuzzy'
  | 'fill_ploshchadka'

function formatTableCell(key: string, v: unknown, colFormat?: string): string {
  if (v == null || v === '') return ''
  if (colFormat === 'money' || MONEY_KEYS.has(key)) {
    const n = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '').replace(',', '.'))
    if (Number.isNaN(n)) return cellText(v)
    return n.toLocaleString('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }
  return cellText(v)
}

function parseMoneyInput(raw: string): number | string {
  const s = raw.replace(/\s/g, '').replace(/₽/g, '').replace(',', '.').trim()
  if (!s) return ''
  const n = Number(s)
  return Number.isNaN(n) ? raw : n
}

export default function TicketCostsEditableGrid({
  registry,
  filters,
  refreshKey,
  processedRowsHint,
  dbHint,
  active = true,
  statusPending = false,
  loadInProgress = false,
  fuzzyFioPercent = 90,
  onFuzzyPercentChange,
  onDataChanged,
}: {
  registry: RegistryId
  filters: TicketCostsFilterState
  refreshKey: number
  processedRowsHint?: number
  dbHint?: string
  /** Загружать данные только когда вкладка таблицы активна */
  active?: boolean
  /** Ждём ответ status API перед первой загрузкой */
  statusPending?: boolean
  /** Не грузить таблицу пока идёт обработка на вкладке загрузки */
  loadInProgress?: boolean
  fuzzyFioPercent?: number
  onFuzzyPercentChange?: (n: number) => void
  onDataChanged?: () => void
}) {
  const api = useExcelApi()
  const {
    status: actionStatusState,
    reset: resetActionStatus,
    runAction: runTableAction,
  } = useTicketCostsActionStatus()

  const serverFetchKey = buildTableFetchKey(registry, refreshKey, filters)
  const cachedOnMount = getTableCache(registry, serverFetchKey)

  const [columns, setColumns] = useState<TicketCostsColumnDef[]>(cachedOnMount?.columns ?? [])
  const [allRows, setAllRows] = useState<TicketCostsDataRow[]>(cachedOnMount?.rows ?? [])
  const [totalRows, setTotalRows] = useState(cachedOnMount?.total ?? cachedOnMount?.rows.length ?? 0)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState<Record<string, TicketCostsDataRow>>({})
  const [msg, setMsg] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [loadAllRows, setLoadAllRows] = useState(false)
  const [, startTransition] = useTransition()
  const deferredAllRows = useDeferredValue(allRows)
  const isHeavyTable = allRows.length > HEAVY_TABLE_ROWS

  const columnKeys = useMemo(() => columns.map((c) => c.key), [columns])
  const colFormatByKey = useMemo(() => {
    const m: Record<string, string | undefined> = {}
    for (const c of columns) m[c.key] = c.format
    return m
  }, [columns])
  const colFilters = useColumnFilters(
    deferredAllRows,
    columnKeys,
    (row, key) => formatTableCell(key, row[key], colFormatByKey[key]),
    200,
    { enabled: !isHeavyTable },
  )

  const rowById = useMemo(() => {
    const map = new Map<string, TicketCostsDataRow>()
    for (const row of allRows) map.set(String(row._row_id), row)
    return map
  }, [allRows])
  const { clearAllFilters, openFilterCol, setOpenFilterCol } = colFilters
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportH, setViewportH] = useState(480)
  const loadedKeyRef = useRef(cachedOnMount ? serverFetchKey : '')
  const fetchInFlightRef = useRef(false)

  const loading = Boolean(actionStatusState?.active)

  const applyPayload = useCallback(
    (res: { columns?: TicketCostsColumnDef[]; data?: TicketCostsDataRow[]; total?: number }) => {
      const cols = res.columns || []
      const rows = res.data || []
      const total = res.total ?? rows.length
      startTransition(() => {
        setColumns(cols)
        setAllRows(rows)
        setTotalRows(total)
      })
      loadedKeyRef.current = serverFetchKey
      clearAllFilters()
      setTableCache(registry, serverFetchKey, { columns: cols, rows, total })
      return rows.length
    },
    [registry, serverFetchKey, clearAllFilters, startTransition],
  )

  const fetchTableData = useCallback(async (allRowsMode?: boolean) => {
    const signal = getTableFetchAbortSignal(registry)
    const useAll = allRowsMode ?? loadAllRows
    const res = await api.ticketsCostsData({
      registry,
      ...filtersToApiParams(filters),
      offset: 0,
      limit: useAll ? 0 : TABLE_FETCH_LIMIT,
      signal,
    })
    return applyPayload(res as { columns?: TicketCostsColumnDef[]; data?: TicketCostsDataRow[]; total?: number })
  }, [api, registry, filters, applyPayload, loadAllRows])

  const handleTableAction = async (action: TableActionId) => {
    setMsg(null)
    const labels: Record<TableActionId, string> = {
      clean_tab_passport: 'Очистить ТАБ, Паспорт',
      enrich_passport: 'Заполнить из Базы по Паспорту',
      enrich_fio_en: 'Заполнить из Базы по ФИО (EN)',
      enrich_fio_fuzzy: 'Заполнить из Базы по ФИО (FUZZY)',
      fill_ploshchadka: 'Заполнить Площадки',
    }
    const steps =
      action === 'clean_tab_passport'
        ? ['Чтение processed', 'Очистка табельного и паспорта', 'Сохранение']
        : action === 'fill_ploshchadka'
          ? ['Чтение processed', 'Справочник подразделений', 'Сохранение']
          : action === 'enrich_fio_fuzzy'
            ? ['Чтение processed', `Fuzzy ФИО (${fuzzyFioPercent}%)`, 'Сохранение']
            : ['Чтение processed', 'Сопоставление с Базой', 'Сохранение']
    try {
      await runTableAction(labels[action], steps, async ({ advance, startElapsedTimer }) => {
        startElapsedTimer(labels[action])
        advance()
        const r = await api.ticketsCostsTableAction(registry, action, {
          fuzzyFioCutoff: fuzzyFioPercent,
        })
        advance()
        advance()
        invalidateTicketCostsCache(registry)
        loadedKeyRef.current = ''
        await fetchTableData()
        onDataChanged?.()
        const parts: string[] = []
        if ((r as { tab_changed?: number }).tab_changed != null) {
          parts.push(`таб.: ${(r as { tab_changed: number }).tab_changed}`)
        }
        if ((r as { passport_changed?: number }).passport_changed != null) {
          parts.push(`пасп.: ${(r as { passport_changed: number }).passport_changed}`)
        }
        if ((r as { filled_passport?: number }).filled_passport) {
          parts.push(`по паспорту: ${(r as { filled_passport: number }).filled_passport}`)
        }
        if ((r as { filled_fio_en?: number }).filled_fio_en) {
          parts.push(`ФИО EN: ${(r as { filled_fio_en: number }).filled_fio_en}`)
        }
        if ((r as { filled_fuzzy?: number }).filled_fuzzy) {
          parts.push(`Fuzzy: ${(r as { filled_fuzzy: number }).filled_fuzzy}`)
        }
        if ((r as { filled_ploshchadka?: number }).filled_ploshchadka != null) {
          parts.push(`площадки: ${(r as { filled_ploshchadka: number }).filled_ploshchadka}`)
        }
        return parts.length ? parts.join(' • ') : 'Готово'
      })
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка операции')
    }
  }

  const loadAll = useCallback(
    async (withStatusBar: boolean) => {
      if (processedRowsHint === 0) {
        setColumns([])
        setAllRows([])
        setTotalRows(0)
        return
      }

      setMsg(null)
      const run = async () => fetchTableData()

      if (!withStatusBar) {
        try {
          await run()
        } catch (e) {
          if (e instanceof Error && e.name === 'AbortError') return
          setMsg(e instanceof Error ? e.message : 'Ошибка загрузки таблицы')
          setAllRows([])
        }
        return
      }

      try {
        await runTableAction(
          'Загрузка таблицы данных',
          ['Запрос к серверу', 'Получение строк', 'Подготовка отображения'],
          async ({ advance, startElapsedTimer }) => {
            startElapsedTimer('Загрузка')
            advance()
            const count = await run()
            advance()
            advance()
            return `${count.toLocaleString('ru-RU')} строк`
          },
        )
      } catch (e) {
        setMsg(e instanceof Error ? e.message : 'Ошибка загрузки таблицы')
        setAllRows([])
      }
    },
    [fetchTableData, processedRowsHint, runTableAction],
  )

  useEffect(() => {
    if (!active || statusPending || loadInProgress) return
    if (processedRowsHint === 0) return

    const hit = getTableCache(registry, serverFetchKey)
    if (hit) {
      setColumns(hit.columns)
      setAllRows(hit.rows)
      setTotalRows(hit.total)
      loadedKeyRef.current = serverFetchKey
      return
    }
    if (loadedKeyRef.current === serverFetchKey) return
    if (fetchInFlightRef.current) return

    let cancelled = false
    fetchInFlightRef.current = true
    void (async () => {
      try {
        await loadAll(true)
      } finally {
        if (!cancelled) loadedKeyRef.current = serverFetchKey
        fetchInFlightRef.current = false
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    serverFetchKey,
    registry,
    active,
    statusPending,
    loadInProgress,
    processedRowsHint,
    loadAll,
  ])

  useEffect(() => {
    if (!openFilterCol) return
    const close = () => setOpenFilterCol(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [openFilterCol, setOpenFilterCol])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setViewportH(el.clientHeight || 480))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const filteredRows = useMemo(() => {
    let rows = colFilters.filteredRows
    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter((row) =>
        columns.some((c) => cellText(row[c.key]).toLowerCase().includes(q)),
      )
    }
    return rows.map((r) => {
      const id = String(r._row_id)
      return dirty[id] ? { ...r, ...dirty[id] } : r
    })
  }, [colFilters.filteredRows, columns, search, dirty])

  const handleServerExport = useCallback(async () => {
    const result = await api.ticketsCostsExportExcel({
      registry,
      search: search.trim() || undefined,
      ...filtersToApiParams(filters),
    })
    if (!result.file_id) {
      throw new Error('Не удалось сформировать файл')
    }
    await api.downloadFile(result.file_id)
  }, [api, registry, filters, search])

  const dirtyCount = Object.keys(dirty).length
  const totalVisible = filteredRows.length
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - VIEW_BUFFER)
  const visibleCount = Math.ceil(viewportH / ROW_HEIGHT) + VIEW_BUFFER * 2
  const endIdx = Math.min(totalVisible, startIdx + visibleCount)
  const windowRows = filteredRows.slice(startIdx, endIdx)
  const topPad = startIdx * ROW_HEIGHT
  const bottomPad = Math.max(0, (totalVisible - endIdx) * ROW_HEIGHT)

  const setCell = (rowId: string, key: string, raw: string) => {
    const fmt = colFormatByKey[key]
    const value = fmt === 'money' || MONEY_KEYS.has(key) ? parseMoneyInput(raw) : raw
    setDirty((prev) => {
      const base = prev[rowId] || rowById.get(rowId) || { _row_id: rowId }
      return { ...prev, [rowId]: { ...base, _row_id: rowId, [key]: value } }
    })
  }

  const handleSave = async () => {
    if (!dirtyCount) return
    setMsg(null)
    setSaving(true)
    try {
      await runTableAction(
        'Сохранение изменений',
        ['Подготовка данных', 'Запись в базу', 'Обновление таблицы'],
        async ({ advance, startElapsedTimer }) => {
          startElapsedTimer('Сохранение')
          advance()
          const payload = Object.values(dirty)
          const res = await api.ticketsCostsSaveRows(registry, payload)
          advance()
          setDirty({})
          invalidateTicketCostsCache(registry)
          loadedKeyRef.current = ''
          advance()
          const count = await fetchTableData()
          return `Сохранено строк: ${(res as { updated?: number }).updated ?? payload.length} • таблица: ${count.toLocaleString('ru-RU')} строк`
        },
      )
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const showStatusBar =
    actionStatusState?.active || actionStatusState?.success || actionStatusState?.error

  return (
    <div className="flex flex-col border border-gray-200 rounded-xl bg-white overflow-hidden flex-1 min-h-0">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b bg-gray-50 shrink-0">
        <Table2 className="h-4 w-4 text-indigo-600" />
        <span className="text-xs font-semibold text-gray-800">Таблица данных (A–U)</span>
        {dbHint && (
          <span className="text-[10px] text-gray-500 truncate max-w-md" title={dbHint}>
            БД: {dbHint}
          </span>
        )}
        <div className="relative flex-1 min-w-[180px] max-w-xs ml-auto">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Быстрый поиск…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setScrollTop(0)
              if (scrollRef.current) scrollRef.current.scrollTop = 0
            }}
            className="w-full h-8 pl-7 pr-7 text-xs border border-gray-300 rounded"
          />
          {search && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
              onClick={() => setSearch('')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <ExportToExcelButton
          fileName={`Затраты_по_билетам_${registry}`}
          columns={columns.map((c) => ({ key: c.key, title: c.title || c.key }))}
          rows={filteredRows}
          disabled={!columns.length || totalRows === 0}
          serverExport={handleServerExport}
          serverExportTitle={
            totalRows > 0
              ? `Сформировать Excel на сервере (${totalRows.toLocaleString('ru-RU')} строк, фильтры дашборда и поиск)`
              : undefined
          }
        />
        <TableEditButton
          title={`Затраты по билетам — ${registry.toUpperCase()}`}
          columns={columns.map((c) => ({ key: c.key, title: c.title || c.key }))}
          rows={filteredRows}
          disabled={!columns.length}
        />
        {totalRows > allRows.length && !loadAllRows && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-[10px]"
            disabled={loading}
            onClick={() => {
              setLoadAllRows(true)
              loadedKeyRef.current = ''
              void (async () => {
                try {
                  await runTableAction(
                    'Загрузка всех строк',
                    ['Запрос к серверу', 'Получение данных'],
                    async ({ advance, startElapsedTimer }) => {
                      startElapsedTimer('Загрузка')
                      advance()
                      const count = await fetchTableData(true)
                      advance()
                      return `${count.toLocaleString('ru-RU')} строк`
                    },
                  )
                } catch (e) {
                  setMsg(e instanceof Error ? e.message : 'Ошибка загрузки')
                }
              })()
            }}
          >
            Все {totalRows.toLocaleString('ru-RU')} строк
          </Button>
        )}
        <span
          className="text-[9px] text-gray-500 hidden lg:inline"
          title="Операции выполняются на сервере по всей итоговой таблице в базе реестра, не только по строкам на экране"
        >
          (по всей таблице в БД)
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-[10px]"
          disabled={loading || !processedRowsHint}
          title="Обработать все строки processed в базе реестра"
          onClick={() => void handleTableAction('clean_tab_passport')}
        >
          Очистить ТАБ, Паспорт
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-[10px]"
          disabled={loading || !processedRowsHint}
          onClick={() => void handleTableAction('fill_ploshchadka')}
        >
          Заполнить Площадки
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-[10px]"
          disabled={loading || !processedRowsHint}
          onClick={() => void handleTableAction('enrich_passport')}
        >
          База по Паспорту
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-[10px]"
          disabled={loading || !processedRowsHint}
          onClick={() => void handleTableAction('enrich_fio_en')}
        >
          База ФИО (EN)
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-[10px]"
          disabled={loading || !processedRowsHint}
          onClick={() => void handleTableAction('enrich_fio_fuzzy')}
        >
          База ФИО (FUZZY)
        </Button>
        <label className="flex items-center gap-1 text-[10px] text-gray-600">
          Fuzzy %
          <input
            type="number"
            min={50}
            max={100}
            value={fuzzyFioPercent}
            onChange={(e) =>
              onFuzzyPercentChange?.(Math.min(100, Math.max(50, Number(e.target.value) || 90)))
            }
            className="h-7 w-12 rounded border px-1 text-xs"
          />
        </label>
        <Button size="sm" className="h-8" disabled={!dirtyCount || saving} onClick={() => void handleSave()}>
          {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
          Сохранить {dirtyCount ? `(${dirtyCount})` : ''}
        </Button>
      </div>

      {showStatusBar && (
        <div className="px-3 py-1.5 border-b shrink-0">
          <TicketCostsActionStatusBar
            status={actionStatusState}
            onDismiss={() => resetActionStatus()}
          />
        </div>
      )}

      {msg && (
        <div className="text-[11px] px-3 py-1 bg-indigo-50 text-indigo-800 border-b shrink-0">{msg}</div>
      )}

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-auto"
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        {loading && allRows.length === 0 ? (
          <div className="p-4 flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Загрузка таблицы…
          </div>
        ) : (
          <table className="w-full border-collapse text-[11px] min-w-max">
            <thead className="sticky top-0 z-30 bg-indigo-50 shadow-sm">
              <tr>
                <th className="px-1 py-1 border-b border-r text-gray-500 w-10 bg-indigo-50">№</th>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="px-1 py-1 border-b border-r text-left font-semibold text-indigo-900 whitespace-nowrap bg-indigo-50 relative"
                  >
                    {isHeavyTable ? (
                      <span className="px-1">{col.title}</span>
                    ) : (
                      <ColumnHeaderFilter
                        colKey={col.key}
                        title={col.title}
                        activeFilter={Boolean(colFilters.columnFilters[col.key]?.size)}
                        isOpen={colFilters.openFilterCol === col.key}
                        uniqueValues={colFilters.uniqueByColumn[col.key] || []}
                        selected={colFilters.columnFilters[col.key]}
                        onToggleOpen={colFilters.setOpenFilterCol}
                        onToggleValue={colFilters.toggleFilterValue}
                        onClear={colFilters.clearColFilter}
                        onSelectAll={colFilters.selectAllFilterValues}
                        onSelectNone={colFilters.selectNoneFilterValues}
                        variant="indigo"
                      />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topPad > 0 && (
                <tr>
                  <td colSpan={columns.length + 1} style={{ height: topPad, padding: 0, border: 0 }} />
                </tr>
              )}
              {windowRows.map((row, ri) => {
                const rowId = String(row._row_id)
                const isDirty = Boolean(dirty[rowId])
                const rowNum = startIdx + ri + 1
                return (
                  <tr
                    key={rowId}
                    style={{ height: ROW_HEIGHT }}
                    className={isDirty ? 'bg-amber-50' : rowNum % 2 === 0 ? 'bg-white' : 'bg-gray-50/80'}
                  >
                    <td className="px-1 border-b border-r text-right text-gray-400 align-middle">
                      {rowNum}
                    </td>
                    {columns.map((col) => {
                      const isMoney = col.format === 'money' || MONEY_KEYS.has(col.key)
                      const display = formatTableCell(col.key, row[col.key], col.format)
                      const editableCell = isDirty || !isHeavyTable
                      return (
                      <td key={col.key} className="border-b border-r p-0 min-w-[90px] max-w-[220px] align-middle">
                        {editableCell ? (
                          <input
                            type="text"
                            inputMode={isMoney ? 'decimal' : 'text'}
                            className={`w-full h-7 px-1.5 text-[11px] bg-transparent border-0 focus:ring-1 focus:ring-indigo-400 focus:bg-white outline-none ${isMoney ? 'text-right tabular-nums' : ''}`}
                            value={display}
                            onChange={(e) => setCell(rowId, col.key, e.target.value)}
                          />
                        ) : (
                          <div
                            className={`h-7 px-1.5 text-[11px] truncate leading-7 ${isMoney ? 'text-right tabular-nums' : ''}`}
                            title={display}
                          >
                            {display}
                          </div>
                        )}
                      </td>
                    )})}
                  </tr>
                )
              })}
              {bottomPad > 0 && (
                <tr>
                  <td colSpan={columns.length + 1} style={{ height: bottomPad, padding: 0, border: 0 }} />
                </tr>
              )}
              {!filteredRows.length && !loading && (
                <tr>
                  <td colSpan={Math.max(columns.length + 1, 2)} className="text-center py-8 text-gray-400">
                    Нет строк. Загрузите и обработайте файлы на вкладке «Загрузить и обработать».
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="border-t bg-gray-50 px-3 py-2 text-[11px] text-gray-600 shrink-0 space-y-0.5">
        <div>
          Показано {totalVisible.toLocaleString('ru-RU')} из {totalRows.toLocaleString('ru-RU')} строк
          {!loadAllRows && totalRows > allRows.length
            ? ` • на экране первые ${allRows.length.toLocaleString('ru-RU')} (лимит ${TABLE_FETCH_LIMIT.toLocaleString('ru-RU')} для скорости)`
            : loadAllRows
              ? isHeavyTable
                ? ' • все строки: быстрый просмотр (поиск сверху; фильтры по столбцам отключены)'
                : ' • загружены все строки в браузер'
              : ''}
          {dirtyCount ? ` • несохранённых правок: ${dirtyCount}` : ''}
        </div>
        {!loadAllRows && totalRows > allRows.length && (
          <div className="text-[10px] text-gray-500">
            Кнопки «Очистить ТАБ…» и «База…» применяются ко всем {totalRows.toLocaleString('ru-RU')} строкам в базе.
            Фильтры и поиск — только по загруженным на экран.
            {' '}
            <button
              type="button"
              className="text-indigo-600 hover:underline"
              disabled={loading}
              onClick={() => {
                setLoadAllRows(true)
                loadedKeyRef.current = ''
                void (async () => {
                  try {
                    await runTableAction(
                      'Загрузка всех строк',
                      ['Запрос к серверу', 'Получение данных'],
                      async ({ advance, startElapsedTimer }) => {
                        startElapsedTimer('Загрузка')
                        advance()
                        const count = await fetchTableData(true)
                        advance()
                        return `${count.toLocaleString('ru-RU')} строк`
                      },
                    )
                  } catch (e) {
                    setMsg(e instanceof Error ? e.message : 'Ошибка загрузки')
                  }
                })()
              }}
            >
              Загрузить все для просмотра
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
