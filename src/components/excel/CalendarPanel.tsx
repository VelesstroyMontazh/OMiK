'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useExcelApi } from '@/hooks/use-excel-api'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import ColumnHeaderFilter from '@/components/excel/ColumnHeaderFilter'
import TableEditButton from '@/components/excel/TableEditButton'
import ExportToExcelButton from '@/components/excel/ExportToExcelButton'
import PathInputWithBrowse from '@/components/excel/PathInputWithBrowse'
import { useColumnFilters } from '@/hooks/useColumnFilters'
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Download,
  GitMerge,
  Loader2,
  Plane,
  RefreshCw,
  Search,
  Ticket,
  Upload,
} from 'lucide-react'

const PAGE_SIZE = 200

const DEFAULT_CALENDAR_PATH =
  'C:\\Otchet_OP_Marina\\Календарь\\Календарь_ОП_Марина_19.05.2026.xlsx'
const DEFAULT_TICKETS_VSM_PATH = 'C:\\Otchet_OP_Marina\\ВСМ_билеты_с 01.01.2025.xlsm'
const DEFAULT_TICKETS_SK_PATH = 'C:\\Otchet_OP_Marina\\СК_билеты_с 01.01.2025.xlsm'

type TicketRegistryId = 'vsm' | 'sk'

interface TicketRegistryStatus {
  registry: TicketRegistryId
  label: string
  loaded: boolean
  file_path?: string
  loaded_at?: string
  row_count?: number
  col_count?: number
  passport_column?: string
}

type PanelTab = 'calendar' | 'merged' | 'reports' | 'tickets'

interface CalendarFilterOptions {
  years?: number[]
  months?: number[]
  directions?: string[]
  justifications?: string[]
  citizenships?: string[]
  arrival_statuses?: string[]
  worker_types?: string[]
  departments?: string[]
}

interface CalendarReportResult {
  title?: string
  total?: number
  file_id?: string
  stored_filename?: string
  preview_rows?: Record<string, unknown>[]
  preview_limit?: number
  by_justification?: Array<{ name: string; count: number }>
  by_citizenship?: Array<{ name: string; count: number }>
  by_month?: Array<{ year: number; month: number; direction: string; count: number }>
  filters_applied?: Record<string, unknown>
}

interface CalendarStatus {
  loaded: boolean
  file_path?: string
  loaded_at?: string
  total_arrivals?: number
  total_departures?: number
  available_years?: number[]
  available_months?: number[]
}

const CALENDAR_COLUMNS = [
  'direction',
  'year',
  'month_name',
  'tab_num',
  'full_name',
  'citizenship',
  'passport_series',
  'passport_number',
  'organization',
  'department',
  'arrival_date',
  'justification',
  'arrival_status',
  'ticket_cost',
]

const MERGED_COLUMNS = [
  'direction',
  'year',
  'month_name',
  'Табельный номер (База)',
  'ФИО (База)',
  'full_name',
  'citizenship',
  'passport_series',
  'passport_number',
  'Организация (База)',
  'Подразделение (База)',
  'Состояние (База)',
  'arrival_date',
  'justification',
  'ticket_cost',
]

const REPORT_PREVIEW_COLUMNS = [
  'direction',
  'year',
  'month_name',
  'full_name',
  'citizenship',
  'justification',
  'arrival_date',
  'arrival_status',
  'department',
  'ticket_cost',
]

const COLUMN_LABELS: Record<string, string> = {
  direction: 'Направление',
  year: 'Год',
  month_name: 'Месяц',
  full_name: 'ФИО',
  citizenship: 'Гражданство',
  justification: 'Обоснование',
  arrival_date: 'Дата прибытия',
  arrival_status: 'Статус',
  department: 'Отдел',
  ticket_cost: 'Сумма билета',
}

function cellValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

export default function CalendarPanel() {
  const api = useExcelApi()

  const [activeTab, setActiveTab] = useState<PanelTab>('calendar')
  const [calendarPath, setCalendarPath] = useState(DEFAULT_CALENDAR_PATH)
  const [status, setStatus] = useState<CalendarStatus>({ loaded: false })
  const [loadingCalendar, setLoadingCalendar] = useState(false)

  const [direction, setDirection] = useState('')
  const [year, setYear] = useState('')
  const [month, setMonth] = useState('')
  const [search, setSearch] = useState('')
  const [localSearch, setLocalSearch] = useState('')

  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loadingData, setLoadingData] = useState(false)

  const [mergedLoaded, setMergedLoaded] = useState(false)
  const [mergedRows, setMergedRows] = useState(0)
  const [mergingCalendar, setMergingCalendar] = useState(false)
  const [calendarOutputName, setCalendarOutputName] = useState('Календарь_с_Базой.xlsx')
  const [calendarMergeResult, setCalendarMergeResult] = useState<{
    file_id: string
    stored_filename: string
    rows: number
    matched_rows: number
    unmatched_rows: number
  } | null>(null)

  const [vsmPath, setVsmPath] = useState(DEFAULT_TICKETS_VSM_PATH)
  const [skPath, setSkPath] = useState(DEFAULT_TICKETS_SK_PATH)
  const [mergeRegistry, setMergeRegistry] = useState<TicketRegistryId>('vsm')
  const [viewRegistry, setViewRegistry] = useState<TicketRegistryId>('vsm')
  const [registryVsm, setRegistryVsm] = useState<TicketRegistryStatus>({
    registry: 'vsm',
    label: 'ВСМ',
    loaded: false,
  })
  const [registrySk, setRegistrySk] = useState<TicketRegistryStatus>({
    registry: 'sk',
    label: 'СК',
    loaded: false,
  })
  const [loadingRegistryVsm, setLoadingRegistryVsm] = useState(false)
  const [loadingRegistrySk, setLoadingRegistrySk] = useState(false)
  const [ticketsOutputName, setTicketsOutputName] = useState('ВСМ_билеты_с_Базой.xlsx')
  const [mergingTickets, setMergingTickets] = useState(false)
  const [ticketsRows, setTicketsRows] = useState<Record<string, unknown>[]>([])
  const [ticketsTotal, setTicketsTotal] = useState(0)
  const [ticketsOffset, setTicketsOffset] = useState(0)
  const [ticketsSearch, setTicketsSearch] = useState('')
  const [ticketsLocalSearch, setTicketsLocalSearch] = useState('')
  const [loadingTicketsData, setLoadingTicketsData] = useState(false)
  const [ticketsResult, setTicketsResult] = useState<{
    file_id: string
    stored_filename: string
    rows: number
    matched_rows: number
    matched_exact?: number
    matched_by_d?: number
    matched_fio_exact?: number
    matched_fio_fuzzy?: number
    matched_fuzzy?: number
    fio_source_column?: string
    unmatched_rows: number
    highlight_rows?: number
    passport_source_column?: string
    fuzzy_cutoff_percent?: number
  } | null>(null)

  const [filterOptions, setFilterOptions] = useState<CalendarFilterOptions>({})
  const [repDirection, setRepDirection] = useState('')
  const [repYear, setRepYear] = useState('')
  const [repMonth, setRepMonth] = useState('')
  const [repDateFrom, setRepDateFrom] = useState('')
  const [repDateTo, setRepDateTo] = useState('')
  const [repJustification, setRepJustification] = useState('')
  const [repJustificationContains, setRepJustificationContains] = useState('')
  const [repCitizenship, setRepCitizenship] = useState('')
  const [repArrivalStatus, setRepArrivalStatus] = useState('')
  const [repWorkerType, setRepWorkerType] = useState('')
  const [repDepartment, setRepDepartment] = useState('')
  const [repOutputName, setRepOutputName] = useState('Отчет_календарь.xlsx')
  const [loadingReport, setLoadingReport] = useState(false)
  const [reportResult, setReportResult] = useState<CalendarReportResult | null>(null)

  const [error, setError] = useState<string | null>(null)

  const displayColumns = activeTab === 'merged' ? MERGED_COLUMNS : CALENDAR_COLUMNS
  const isMergedView = activeTab === 'merged'

  const calColFilters = useColumnFilters(rows, displayColumns)
  const visibleCalRows = useMemo(() => {
    const allowed = new Set(calColFilters.filteredRows)
    return rows.filter((r) => allowed.has(r))
  }, [rows, calColFilters.filteredRows])

  const ticketsColumns = useMemo(
    () => (ticketsRows[0] ? Object.keys(ticketsRows[0]).slice(0, 14) : []),
    [ticketsRows],
  )
  const ticketsColFilters = useColumnFilters(ticketsRows, ticketsColumns)
  const visibleTicketRows = useMemo(() => {
    const allowed = new Set(ticketsColFilters.filteredRows)
    return ticketsRows.filter((r) => allowed.has(r))
  }, [ticketsRows, ticketsColFilters.filteredRows])

  const calEditColumns = useMemo(
    () => displayColumns.map((c) => ({ key: c, title: c })),
    [displayColumns],
  )
  const ticketsEditColumns = useMemo(
    () => ticketsColumns.map((c) => ({ key: c, title: c })),
    [ticketsColumns],
  )

  const refreshTicketsRegistry = useCallback(async () => {
    try {
      const result = await api.ticketsRegistryStatus()
      const registries = (result.registries || {}) as Record<
        string,
        TicketRegistryStatus
      >
      if (registries.vsm) setRegistryVsm(registries.vsm)
      else setRegistryVsm({ registry: 'vsm', label: 'ВСМ', loaded: false })
      if (registries.sk) setRegistrySk(registries.sk)
      else setRegistrySk({ registry: 'sk', label: 'СК', loaded: false })
    } catch {
      setRegistryVsm({ registry: 'vsm', label: 'ВСМ', loaded: false })
      setRegistrySk({ registry: 'sk', label: 'СК', loaded: false })
    }
  }, [api])

  const refreshStatus = useCallback(async () => {
    try {
      const result = await api.calendarStatus()
      setStatus(result as CalendarStatus)
    } catch {
      setStatus({ loaded: false })
    }
    try {
      const merged = await api.calendarMergedStatus()
      setMergedLoaded(Boolean(merged.loaded))
      if (merged.loaded) setMergedRows(merged.rows || 0)
    } catch {
      setMergedLoaded(false)
    }
    try {
      const filters = await api.getReportFilters()
      setFilterOptions((filters.calendar || {}) as CalendarFilterOptions)
    } catch {
      setFilterOptions({})
    }
  }, [api])

  const loadData = useCallback(async () => {
    if (activeTab === 'reports' || activeTab === 'tickets') {
      return
    }
    if (isMergedView && !mergedLoaded) {
      setRows((prev) => (prev.length === 0 ? prev : []))
      setTotalRows((prev) => (prev === 0 ? prev : 0))
      return
    }
    if (!isMergedView && !status.loaded) {
      setRows((prev) => (prev.length === 0 ? prev : []))
      setTotalRows((prev) => (prev === 0 ? prev : 0))
      return
    }

    setLoadingData(true)
    setError(null)
    try {
      const params = {
        direction: direction || undefined,
        year: year ? Number(year) : undefined,
        month: month ? Number(month) : undefined,
        search: search || undefined,
        offset,
        limit: PAGE_SIZE,
      }
      const result = isMergedView
        ? await api.calendarMergedData(params)
        : await api.calendarData(params)

      setRows((result.data || []) as Record<string, unknown>[])
      setTotalRows(result.total || 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки данных')
    } finally {
      setLoadingData(false)
    }
  }, [activeTab, api, direction, isMergedView, mergedLoaded, month, offset, search, status.loaded, year])

  useEffect(() => {
    void refreshStatus()
    void refreshTicketsRegistry()
  }, [refreshStatus, refreshTicketsRegistry])

  const loadTicketsRegistryData = useCallback(async () => {
    const active = viewRegistry === 'sk' ? registrySk : registryVsm
    if (!active.loaded) {
      setTicketsRows([])
      setTicketsTotal(0)
      return
    }
    setLoadingTicketsData(true)
    setError(null)
    try {
      const result = await api.ticketsRegistryData({
        registry: viewRegistry,
        search: ticketsSearch || undefined,
        offset: ticketsOffset,
        limit: PAGE_SIZE,
      })
      setTicketsRows((result.data || []) as Record<string, unknown>[])
      setTicketsTotal(result.total || 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки реестра')
    } finally {
      setLoadingTicketsData(false)
    }
  }, [api, registrySk, registrySk.loaded, registryVsm, registryVsm.loaded, ticketsOffset, ticketsSearch, viewRegistry])

  useEffect(() => {
    if (activeTab === 'tickets') {
      void loadTicketsRegistryData()
    }
  }, [activeTab, loadTicketsRegistryData])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleLoadCalendar = useCallback(async () => {
    setError(null)
    setLoadingCalendar(true)
    try {
      const result = await api.loadCalendarByPath(calendarPath.trim())
      setStatus({
        loaded: true,
        file_path: result.file_path,
        total_arrivals: result.total_arrivals,
        total_departures: result.total_departures,
        available_years: result.available_years,
        available_months: result.available_months,
      })
      setOffset(0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки календаря')
    } finally {
      setLoadingCalendar(false)
    }
  }, [api, calendarPath])

  const handleMergeCalendar = useCallback(async () => {
    setError(null)
    setCalendarMergeResult(null)
    setMergingCalendar(true)
    try {
      const result = await api.mergeCalendarWithMainDb(calendarOutputName.trim() || undefined)
      setCalendarMergeResult({
        file_id: result.file_id,
        stored_filename: result.stored_filename,
        rows: result.rows,
        matched_rows: result.matched_rows,
        unmatched_rows: result.unmatched_rows,
      })
      setMergedLoaded(true)
      setMergedRows(result.rows)
      setActiveTab('merged')
      setOffset(0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка объединения календаря с Базой')
    } finally {
      setMergingCalendar(false)
    }
  }, [api, calendarOutputName])

  const handleLoadTicketsRegistry = useCallback(
    async (registry: TicketRegistryId) => {
      setError(null)
      const path = registry === 'vsm' ? vsmPath.trim() : skPath.trim()
      if (!path) {
        setError(`Укажите путь к реестру билетов (${registry === 'vsm' ? 'ВСМ' : 'СК'})`)
        return
      }
      const setLoading = registry === 'vsm' ? setLoadingRegistryVsm : setLoadingRegistrySk
      setLoading(true)
      try {
        const result = await api.ticketsRegistryLoad({ file_path: path, registry })
        const st: TicketRegistryStatus = {
          registry,
          label: registry === 'vsm' ? 'ВСМ' : 'СК',
          loaded: true,
          file_path: result.file_path,
          loaded_at: result.loaded_at,
          row_count: result.row_count,
          col_count: result.col_count,
          passport_column: result.passport_column,
        }
        if (registry === 'vsm') setRegistryVsm(st)
        else setRegistrySk(st)
        setViewRegistry(registry)
        setMergeRegistry(registry)
        setTicketsOffset(0)
        if (registry === 'vsm') {
          setTicketsOutputName('ВСМ_билеты_с_Базой.xlsx')
        } else {
          setTicketsOutputName('СК_билеты_с_Базой.xlsx')
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки реестра билетов')
      } finally {
        setLoading(false)
      }
    },
    [api, skPath, vsmPath],
  )

  const handleMergeTickets = useCallback(async () => {
    setError(null)
    setTicketsResult(null)
    const regStatus = mergeRegistry === 'sk' ? registrySk : registryVsm
    const useRegistry = regStatus.loaded
    const filePath = mergeRegistry === 'vsm' ? vsmPath.trim() : skPath.trim()
    if (!useRegistry && !filePath) {
      setError(`Загрузите реестр ${mergeRegistry === 'vsm' ? 'ВСМ' : 'СК'} или укажите путь к файлу`)
      return
    }
    setMergingTickets(true)
    try {
      const result = await api.mergeTicketsWithMainDb({
        ticket_file_path: useRegistry ? undefined : filePath,
        output_name: ticketsOutputName.trim() || undefined,
        use_registry: useRegistry,
        registry: mergeRegistry,
      })
      setTicketsResult({
        file_id: result.file_id,
        stored_filename: result.stored_filename,
        rows: result.rows,
        matched_rows: result.matched_rows,
        matched_exact: result.matched_exact,
        matched_by_d: result.matched_by_d,
        matched_fio_exact: result.matched_fio_exact,
        matched_fio_fuzzy: result.matched_fio_fuzzy,
        matched_fuzzy: result.matched_fuzzy,
        fio_source_column: result.fio_source_column,
        unmatched_rows: result.unmatched_rows,
        highlight_rows: result.highlight_rows,
        passport_source_column: result.passport_source_column,
        fuzzy_cutoff_percent: result.fuzzy_cutoff_percent,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка объединения отчета билетов с Базой')
    } finally {
      setMergingTickets(false)
    }
  }, [api, mergeRegistry, registrySk, registryVsm, skPath, ticketsOutputName, vsmPath])

  useEffect(() => {
    if (mergeRegistry === 'sk') {
      setTicketsOutputName('СК_билеты_с_Базой.xlsx')
    } else {
      setTicketsOutputName('ВСМ_билеты_с_Базой.xlsx')
    }
  }, [mergeRegistry])

  const applyReportPreset = useCallback((preset: 'vylet_uvoln' | 'prilet_hire' | 'subpodryad') => {
    setRepJustification('')
    if (preset === 'vylet_uvoln') {
      setRepDirection('Вылет')
      setRepJustificationContains('увольн')
    } else if (preset === 'prilet_hire') {
      setRepDirection('Прилет')
      setRepJustification('Устройство на работу')
      setRepJustificationContains('')
    } else {
      setRepDirection('')
      setRepJustification('Субподрядчик')
      setRepJustificationContains('')
    }
    setReportResult(null)
  }, [])

  const handleGenerateReport = useCallback(async () => {
    if (!status.loaded) {
      setError('Сначала загрузите календарь')
      return
    }
    setError(null)
    setLoadingReport(true)
    setReportResult(null)
    try {
      const result = await api.generateReport({
        report_type: 'calendar_conditional',
        direction: repDirection || null,
        year: repYear ? Number(repYear) : null,
        month: repMonth ? Number(repMonth) : null,
        citizenship: repCitizenship || null,
        justification: repJustificationContains ? null : (repJustification || null),
        justification_contains: repJustificationContains || null,
        arrival_status: repArrivalStatus || null,
        worker_type: repWorkerType || null,
        department: repDepartment || null,
        start_date: repDateFrom.trim() || null,
        end_date: repDateTo.trim() || null,
        output_name: repOutputName.trim() || null,
      })
      setReportResult(result as CalendarReportResult)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка формирования отчета')
    } finally {
      setLoadingReport(false)
    }
  }, [
    api,
    repArrivalStatus,
    repCitizenship,
    repDateFrom,
    repDateTo,
    repDepartment,
    repDirection,
    repJustification,
    repJustificationContains,
    repMonth,
    repOutputName,
    repWorkerType,
    repYear,
    status.loaded,
  ])

  const applySearch = useCallback(() => {
    setSearch(localSearch)
    setOffset(0)
  }, [localSearch])

  const pageInfo = useMemo(() => {
    const from = totalRows === 0 ? 0 : offset + 1
    const to = Math.min(offset + PAGE_SIZE, totalRows)
    return { from, to }
  }, [offset, totalRows])

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-50">
      <div className="border-b border-gray-200 bg-white px-4 py-3 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-600 flex items-center justify-center shadow">
            <Plane className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-800">Календарь Прилет-Вылет</h2>
            <p className="text-[11px] text-gray-500">
              Загрузка календаря, объединение с Основной Базой и отчёты
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-8" onClick={() => void refreshStatus()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Обновить
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {([
            ['calendar', 'Календарь'],
            ['merged', 'Календарь + База'],
            ['reports', 'Отчёты'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setActiveTab(id)
                setOffset(0)
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                activeTab === id
                  ? 'bg-sky-50 border-sky-300 text-sky-800'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'calendar' && (
          <div className="flex flex-wrap items-center gap-2">
            <PathInputWithBrowse
              value={calendarPath}
              onChange={setCalendarPath}
              mode="file"
              placeholder="Путь к файлу календаря"
              inputClassName="h-8 flex-1 min-w-[320px] rounded border border-gray-300 px-2 text-xs"
            />
            <Button size="sm" onClick={() => void handleLoadCalendar()} disabled={loadingCalendar}>
              {loadingCalendar ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <CalendarDays className="h-3.5 w-3.5 mr-1" />}
              Загрузить и обработать
            </Button>
          </div>
        )}

        {activeTab === 'merged' && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={calendarOutputName}
              onChange={(e) => setCalendarOutputName(e.target.value)}
              className="h-8 w-[240px] rounded border border-gray-300 px-2 text-xs"
              placeholder="Имя Excel-файла"
            />
            <Button size="sm" onClick={() => void handleMergeCalendar()} disabled={mergingCalendar || !status.loaded}>
              {mergingCalendar ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <GitMerge className="h-3.5 w-3.5 mr-1" />}
              Объединить с Базой
            </Button>
            {!status.loaded && (
              <span className="text-[11px] text-amber-700">Сначала загрузите календарь на вкладке «Календарь»</span>
            )}
          </div>
        )}

        {activeTab === 'tickets' && (
          <div className="space-y-2 w-full">
            <div className="flex flex-wrap items-center gap-2 border border-sky-100 bg-sky-50/50 rounded px-2 py-2">
              <span className="text-[11px] font-semibold text-sky-800 w-10">ВСМ</span>
              <PathInputWithBrowse
                value={vsmPath}
                onChange={setVsmPath}
                mode="file"
                placeholder="Путь к реестру ВСМ (.xlsm)"
                className="flex flex-1 min-w-[240px] items-center gap-2"
                inputClassName="h-8 flex-1 min-w-[180px] rounded border border-gray-300 px-2 text-xs bg-white"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleLoadTicketsRegistry('vsm')}
                disabled={loadingRegistryVsm}
              >
                {loadingRegistryVsm ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5 mr-1" />
                )}
                Загрузить Реестр по Билетам
              </Button>
              {registryVsm.loaded && (
                <span className="text-[10px] text-emerald-700">
                  ✓ {registryVsm.row_count?.toLocaleString('ru-RU')} строк
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 border border-violet-100 bg-violet-50/50 rounded px-2 py-2">
              <span className="text-[11px] font-semibold text-violet-800 w-10">СК</span>
              <PathInputWithBrowse
                value={skPath}
                onChange={setSkPath}
                mode="file"
                placeholder="Путь к реестру СК (.xlsm)"
                className="flex flex-1 min-w-[240px] items-center gap-2"
                inputClassName="h-8 flex-1 min-w-[180px] rounded border border-gray-300 px-2 text-xs bg-white"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleLoadTicketsRegistry('sk')}
                disabled={loadingRegistrySk}
              >
                {loadingRegistrySk ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5 mr-1" />
                )}
                Загрузить Реестр по Билетам
              </Button>
              {registrySk.loaded && (
                <span className="text-[10px] text-emerald-700">
                  ✓ {registrySk.row_count?.toLocaleString('ru-RU')} строк
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-[10px] text-gray-500 flex items-center gap-1">
                Объединить реестр
                <select
                  value={mergeRegistry}
                  onChange={(e) => setMergeRegistry(e.target.value as TicketRegistryId)}
                  className="h-8 rounded border border-gray-300 px-2 text-xs"
                >
                  <option value="vsm">ВСМ</option>
                  <option value="sk">СК</option>
                </select>
              </label>
              <input
                value={ticketsOutputName}
                onChange={(e) => setTicketsOutputName(e.target.value)}
                className="h-8 w-[220px] rounded border border-gray-300 px-2 text-xs"
                placeholder="Имя результата"
              />
              <Button size="sm" onClick={() => void handleMergeTickets()} disabled={mergingTickets}>
                {mergingTickets ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Ticket className="h-3.5 w-3.5 mr-1" />
                )}
                Объединить с Базой
              </Button>
              <span className="text-[10px] text-gray-500">
                {(mergeRegistry === 'sk' ? registrySk : registryVsm).loaded
                  ? 'Используется сохранённый реестр в программе'
                  : 'Сначала загрузите реестр или укажите путь к файлу'}
                {mergingTickets ? ' • объединение может занять 10–40 мин, не закрывайте страницу' : ''}
              </span>
            </div>
          </div>
        )}

        {status.loaded && activeTab !== 'tickets' && activeTab !== 'reports' && (
          <div className="text-[11px] text-gray-600 flex flex-wrap gap-3">
            <span>Файл: {status.file_path}</span>
            <span>Прилет: {status.total_arrivals?.toLocaleString('ru-RU')}</span>
            <span>Вылет: {status.total_departures?.toLocaleString('ru-RU')}</span>
          </div>
        )}

        {calendarMergeResult && activeTab === 'merged' && (
          <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            {calendarMergeResult.stored_filename}: строк {calendarMergeResult.rows}, сопоставлено {calendarMergeResult.matched_rows}, не найдено {calendarMergeResult.unmatched_rows}
            <Button size="sm" variant="outline" className="h-7 ml-auto" onClick={() => void api.downloadFile(calendarMergeResult.file_id)}>
              <Download className="h-3 w-3 mr-1" />
              Скачать Excel
            </Button>
          </div>
        )}

        {ticketsResult && activeTab === 'tickets' && (
          <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1 flex items-center gap-2 flex-wrap">
            <CheckCircle2 className="h-4 w-4" />
            <span>
              {ticketsResult.stored_filename}: строк {ticketsResult.rows}
              {ticketsResult.matched_exact != null
                ? ` • точное: ${ticketsResult.matched_exact.toLocaleString('ru-RU')}`
                : ''}
              {ticketsResult.matched_by_d != null
                ? ` • по номеру D: ${ticketsResult.matched_by_d.toLocaleString('ru-RU')}`
                : ''}
              {ticketsResult.matched_fio_exact != null
                ? ` • точное по ФИО: ${ticketsResult.matched_fio_exact.toLocaleString('ru-RU')}`
                : ''}
              {ticketsResult.matched_fio_fuzzy != null
                ? ` • нечёткое по ФИО: ${ticketsResult.matched_fio_fuzzy.toLocaleString('ru-RU')}`
                : ''}
              {ticketsResult.matched_fuzzy != null
                ? ` • нечёткое по паспорту: ${ticketsResult.matched_fuzzy.toLocaleString('ru-RU')}`
                : ''}
              {` • не найдено: ${ticketsResult.unmatched_rows.toLocaleString('ru-RU')}`}
              {ticketsResult.passport_source_column ? ` • паспорт: ${ticketsResult.passport_source_column}` : ''}
              {ticketsResult.fio_source_column ? ` • ФИО: ${ticketsResult.fio_source_column}` : ''}
            </span>
            <span className="text-amber-700">
              Строки «Нечёткое» и «Не найдено» выделены светло-жёлтым в Excel
              {ticketsResult.highlight_rows != null
                ? ` (${ticketsResult.highlight_rows.toLocaleString('ru-RU')} шт.)`
                : ''}
            </span>
            <Button size="sm" variant="outline" className="h-7 ml-auto" onClick={() => void api.downloadFile(ticketsResult.file_id)}>
              <Download className="h-3 w-3 mr-1" />
              Скачать Excel
            </Button>
          </div>
        )}

        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">{error}</div>
        )}
      </div>

      {activeTab === 'reports' && (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="border-b border-gray-200 bg-white px-4 py-3 space-y-3">
            <div className="text-xs font-semibold text-gray-700">Условия отчёта</div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => applyReportPreset('vylet_uvoln')}>
                Вылет + увольнение
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => applyReportPreset('prilet_hire')}>
                Прилет + устройство на работу
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => applyReportPreset('subpodryad')}>
                Субподрядчик
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              <label className="text-[10px] text-gray-500">
                Направление
                <select value={repDirection} onChange={(e) => setRepDirection(e.target.value)} className="mt-0.5 h-8 w-full rounded border border-gray-300 px-2 text-xs">
                  <option value="">Все</option>
                  <option value="Прилет">Прилет</option>
                  <option value="Вылет">Вылет</option>
                </select>
              </label>
              <label className="text-[10px] text-gray-500">
                Год
                <select value={repYear} onChange={(e) => setRepYear(e.target.value)} className="mt-0.5 h-8 w-full rounded border border-gray-300 px-2 text-xs">
                  <option value="">Все</option>
                  {(filterOptions.years || status.available_years || []).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </label>
              <label className="text-[10px] text-gray-500">
                Месяц
                <select value={repMonth} onChange={(e) => setRepMonth(e.target.value)} className="mt-0.5 h-8 w-full rounded border border-gray-300 px-2 text-xs">
                  <option value="">Все</option>
                  {(filterOptions.months || status.available_months || []).map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label className="text-[10px] text-gray-500">
                Дата с
                <input value={repDateFrom} onChange={(e) => setRepDateFrom(e.target.value)} placeholder="01.01.2025" className="mt-0.5 h-8 w-full rounded border border-gray-300 px-2 text-xs" />
              </label>
              <label className="text-[10px] text-gray-500">
                Дата по
                <input value={repDateTo} onChange={(e) => setRepDateTo(e.target.value)} placeholder="31.12.2025" className="mt-0.5 h-8 w-full rounded border border-gray-300 px-2 text-xs" />
              </label>
              <label className="text-[10px] text-gray-500">
                Обоснование (точное)
                <select value={repJustification} onChange={(e) => { setRepJustification(e.target.value); if (e.target.value) setRepJustificationContains('') }} className="mt-0.5 h-8 w-full rounded border border-gray-300 px-2 text-xs">
                  <option value="">—</option>
                  {(filterOptions.justifications || []).slice(0, 200).map((j) => (
                    <option key={j} value={j}>{j.length > 40 ? `${j.slice(0, 40)}…` : j}</option>
                  ))}
                </select>
              </label>
              <label className="text-[10px] text-gray-500 col-span-2">
                Обоснование содержит
                <input value={repJustificationContains} onChange={(e) => { setRepJustificationContains(e.target.value); if (e.target.value) setRepJustification('') }} placeholder="увольн, субподряд, отпуск…" className="mt-0.5 h-8 w-full rounded border border-gray-300 px-2 text-xs" />
              </label>
              <label className="text-[10px] text-gray-500">
                Гражданство
                <select value={repCitizenship} onChange={(e) => setRepCitizenship(e.target.value)} className="mt-0.5 h-8 w-full rounded border border-gray-300 px-2 text-xs">
                  <option value="">Все</option>
                  {(filterOptions.citizenships || []).map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="text-[10px] text-gray-500">
                Статус прибытия
                <select value={repArrivalStatus} onChange={(e) => setRepArrivalStatus(e.target.value)} className="mt-0.5 h-8 w-full rounded border border-gray-300 px-2 text-xs">
                  <option value="">Все</option>
                  {(filterOptions.arrival_statuses || []).map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="text-[10px] text-gray-500">
                Рабочий/ИТР
                <select value={repWorkerType} onChange={(e) => setRepWorkerType(e.target.value)} className="mt-0.5 h-8 w-full rounded border border-gray-300 px-2 text-xs">
                  <option value="">Все</option>
                  {(filterOptions.worker_types || []).map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="text-[10px] text-gray-500">
                Отдел
                <select value={repDepartment} onChange={(e) => setRepDepartment(e.target.value)} className="mt-0.5 h-8 w-full rounded border border-gray-300 px-2 text-xs">
                  <option value="">Все</option>
                  {(filterOptions.departments || []).slice(0, 150).map((v) => (
                    <option key={v} value={v}>{v.length > 35 ? `${v.slice(0, 35)}…` : v}</option>
                  ))}
                </select>
              </label>
              <label className="text-[10px] text-gray-500 col-span-2">
                Имя Excel-файла
                <input value={repOutputName} onChange={(e) => setRepOutputName(e.target.value)} className="mt-0.5 h-8 w-full rounded border border-gray-300 px-2 text-xs" />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => void handleGenerateReport()} disabled={loadingReport || !status.loaded}>
                {loadingReport ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <BarChart3 className="h-3.5 w-3.5 mr-1" />}
                Сформировать отчёт
              </Button>
              {!status.loaded && (
                <span className="text-[11px] text-amber-700">Сначала загрузите календарь</span>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            {!reportResult ? (
              <div className="p-8 text-center text-sm text-gray-500">
                Задайте условия и нажмите «Сформировать отчёт». Будет показана сводка, таблица и Excel для скачивания.
              </div>
            ) : (
              <div className="p-4 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-sm font-semibold text-gray-800">{reportResult.title || 'Отчёт по календарю'}</div>
                  <div className="text-xs text-gray-600">Записей: <strong>{reportResult.total?.toLocaleString('ru-RU')}</strong></div>
                  {reportResult.file_id && (
                    <Button size="sm" variant="outline" className="h-7 ml-auto" onClick={() => void api.downloadFile(reportResult.file_id!)}>
                      <Download className="h-3 w-3 mr-1" />
                      Скачать Excel ({reportResult.stored_filename})
                    </Button>
                  )}
                </div>

                {reportResult.by_justification && reportResult.by_justification.length > 0 && (
                  <div className="rounded border border-gray-200 bg-white p-3">
                    <div className="text-xs font-semibold text-gray-700 mb-2">По обоснованию (топ)</div>
                    <div className="space-y-1">
                      {reportResult.by_justification.slice(0, 8).map((item) => (
                        <div key={item.name} className="flex justify-between text-[11px]">
                          <span className="truncate mr-2">{item.name}</span>
                          <span className="font-medium">{item.count.toLocaleString('ru-RU')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {reportResult.preview_rows && reportResult.preview_rows.length > 0 && (
                  <div className="overflow-auto rounded border border-gray-200 bg-white">
                    <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-100">
                      Предпросмотр (первые {Math.min(reportResult.preview_rows.length, reportResult.preview_limit || 200)} из {reportResult.total?.toLocaleString('ru-RU')})
                    </div>
                    <table className="w-full text-[11px] border-collapse">
                      <thead className="bg-gray-100">
                        <tr>
                          {REPORT_PREVIEW_COLUMNS.map((col) => (
                            <th key={col} className="border border-gray-200 px-2 py-1 text-left font-semibold whitespace-nowrap">
                              {COLUMN_LABELS[col] || col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {reportResult.preview_rows.map((row, idx) => (
                          <tr key={idx} className="even:bg-white odd:bg-gray-50/50">
                            {REPORT_PREVIEW_COLUMNS.map((col) => (
                              <td key={col} className="border border-gray-100 px-2 py-1 whitespace-nowrap max-w-[200px] truncate" title={cellValue(row[col])}>
                                {cellValue(row[col])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {activeTab !== 'tickets' && activeTab !== 'reports' && (
        <>
          <div className="border-b border-gray-200 bg-white px-4 py-2 flex flex-wrap items-center gap-2">
            <select
              value={direction}
              onChange={(e) => {
                setDirection(e.target.value)
                setOffset(0)
              }}
              className="h-8 rounded border border-gray-300 px-2 text-xs"
            >
              <option value="">Все направления</option>
              <option value="Прилет">Прилет</option>
              <option value="Вылет">Вылет</option>
            </select>
            <select
              value={year}
              onChange={(e) => {
                setYear(e.target.value)
                setOffset(0)
              }}
              className="h-8 rounded border border-gray-300 px-2 text-xs"
            >
              <option value="">Все годы</option>
              {(status.available_years || []).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select
              value={month}
              onChange={(e) => {
                setMonth(e.target.value)
                setOffset(0)
              }}
              className="h-8 rounded border border-gray-300 px-2 text-xs"
            >
              <option value="">Все месяцы</option>
              {(status.available_months || []).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <input
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applySearch()}
                className="h-8 w-[220px] rounded border border-gray-300 px-2 text-xs"
                placeholder="Поиск по ФИО / таб. номеру"
              />
              <Button size="sm" variant="outline" className="h-8" onClick={applySearch}>
                <Search className="h-3.5 w-3.5" />
              </Button>
            </div>
            <ExportToExcelButton
              fileName={isMergedView ? 'Календарь_с_Базой' : 'Календарь'}
              columns={calEditColumns}
              rows={calColFilters.filteredRows}
            />
            <TableEditButton
              title={isMergedView ? 'Календарь + База' : 'Календарь'}
              columns={calEditColumns}
              rows={calColFilters.filteredRows}
            />
            <div className="ml-auto text-xs text-gray-500">
              {loadingData ? 'Загрузка…' : `${pageInfo.from}–${pageInfo.to} из ${totalRows.toLocaleString('ru-RU')}`}
              {isMergedView && mergedLoaded && ` • объединено ${mergedRows.toLocaleString('ru-RU')} записей`}
            </div>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            {!status.loaded && !isMergedView ? (
              <div className="p-8 text-center text-sm text-gray-500">
                Календарь не загружен. Укажите путь и нажмите «Загрузить и обработать».
              </div>
            ) : isMergedView && !mergedLoaded ? (
              <div className="p-8 text-center text-sm text-gray-500">
                Объединенный набор не построен. Нажмите «Объединить с Базой».
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-[11px] border-collapse">
                  <thead className="sticky top-0 bg-gray-100 z-10">
                    <tr>
                      {displayColumns.map((col) => (
                        <th key={col} className="border border-gray-200 px-2 py-1.5 text-left font-semibold text-gray-700 whitespace-nowrap relative">
                          <ColumnHeaderFilter
                            colKey={col}
                            title={col}
                            activeFilter={Boolean(calColFilters.columnFilters[col]?.size)}
                            isOpen={calColFilters.openFilterCol === col}
                            uniqueValues={calColFilters.uniqueByColumn[col] || []}
                            selected={calColFilters.columnFilters[col]}
                            onToggleOpen={calColFilters.setOpenFilterCol}
                            onToggleValue={calColFilters.toggleFilterValue}
                            onClear={calColFilters.clearColFilter}
                            onSelectAll={calColFilters.selectAllFilterValues}
                            onSelectNone={calColFilters.selectNoneFilterValues}
                            variant="gray"
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCalRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-sky-50/50 even:bg-white odd:bg-gray-50/40">
                        {displayColumns.map((col) => (
                          <td key={col} className="border border-gray-100 px-2 py-1 whitespace-nowrap max-w-[220px] truncate" title={cellValue(row[col])}>
                            {cellValue(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ScrollArea>

          <div className="border-t border-gray-200 bg-white px-4 py-2 flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={offset <= 0 || loadingData}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              Назад
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={offset + PAGE_SIZE >= totalRows || loadingData}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Вперед
            </Button>
          </div>
        </>
      )}

      {activeTab === 'tickets' && (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="border-b border-gray-200 bg-white px-4 py-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-700">Просмотр реестра:</span>
            <Button
              size="sm"
              variant={viewRegistry === 'vsm' ? 'default' : 'outline'}
              className="h-7 text-xs"
              onClick={() => {
                setViewRegistry('vsm')
                setTicketsOffset(0)
              }}
            >
              ВСМ
              {registryVsm.loaded ? ` (${registryVsm.row_count?.toLocaleString('ru-RU')})` : ''}
            </Button>
            <Button
              size="sm"
              variant={viewRegistry === 'sk' ? 'default' : 'outline'}
              className="h-7 text-xs"
              onClick={() => {
                setViewRegistry('sk')
                setTicketsOffset(0)
              }}
            >
              СК
              {registrySk.loaded ? ` (${registrySk.row_count?.toLocaleString('ru-RU')})` : ''}
            </Button>
            <div className="flex items-center gap-1 ml-auto">
              <Search className="h-3.5 w-3.5 text-gray-400" />
              <input
                value={ticketsLocalSearch}
                onChange={(e) => setTicketsLocalSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setTicketsSearch(ticketsLocalSearch)
                    setTicketsOffset(0)
                  }
                }}
                className="h-7 w-[200px] rounded border border-gray-300 px-2 text-xs"
                placeholder="Поиск в реестре..."
              />
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => {
                  setTicketsSearch(ticketsLocalSearch)
                  setTicketsOffset(0)
                }}
              >
                Найти
              </Button>
              <Button size="sm" variant="ghost" className="h-7" onClick={() => void refreshTicketsRegistry()}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              <TableEditButton
                title={`Билеты ${viewRegistry === 'vsm' ? 'ВелесстройМонтаж' : 'Стройконстракшен'}`}
                columns={ticketsEditColumns}
                rows={ticketsColFilters.filteredRows}
              />
            </div>
          </div>

          {(viewRegistry === 'vsm' ? registryVsm : registrySk).loaded ? (
            <>
              <ScrollArea className="flex-1">
                <div className="min-w-max">
                  <table className="w-full text-xs border-collapse">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        {ticketsColumns.map((col) => (
                          <th
                            key={col}
                            className="border border-gray-200 px-2 py-1 text-left font-medium text-gray-600 whitespace-nowrap relative"
                          >
                            <ColumnHeaderFilter
                              colKey={col}
                              title={col}
                              activeFilter={Boolean(ticketsColFilters.columnFilters[col]?.size)}
                              isOpen={ticketsColFilters.openFilterCol === col}
                              uniqueValues={ticketsColFilters.uniqueByColumn[col] || []}
                              selected={ticketsColFilters.columnFilters[col]}
                              onToggleOpen={ticketsColFilters.setOpenFilterCol}
                              onToggleValue={ticketsColFilters.toggleFilterValue}
                              onClear={ticketsColFilters.clearColFilter}
                              variant="gray"
                            />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {loadingTicketsData ? (
                        <tr>
                          <td colSpan={14} className="px-4 py-8 text-center text-gray-400">
                            <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                            Загрузка...
                          </td>
                        </tr>
                      ) : ticketsRows.length === 0 ? (
                        <tr>
                          <td colSpan={14} className="px-4 py-8 text-center text-gray-400">
                            Нет данных
                          </td>
                        </tr>
                      ) : (
                        visibleTicketRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            {Object.keys(row)
                              .slice(0, 14)
                              .map((col) => (
                                <td
                                  key={col}
                                  className="border border-gray-100 px-2 py-0.5 whitespace-nowrap max-w-[200px] truncate"
                                >
                                  {cellValue(row[col])}
                                </td>
                              ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </ScrollArea>
              <div className="border-t border-gray-200 bg-white px-4 py-2 flex items-center gap-2 text-xs text-gray-600">
                <span>
                  {viewRegistry === 'vsm' ? 'ВСМ' : 'СК'}: {ticketsOffset + 1}–
                  {Math.min(ticketsOffset + PAGE_SIZE, ticketsTotal)} из {ticketsTotal.toLocaleString('ru-RU')}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={ticketsOffset <= 0 || loadingTicketsData}
                  onClick={() => setTicketsOffset(Math.max(0, ticketsOffset - PAGE_SIZE))}
                >
                  Назад
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={ticketsOffset + PAGE_SIZE >= ticketsTotal || loadingTicketsData}
                  onClick={() => setTicketsOffset(ticketsOffset + PAGE_SIZE)}
                >
                  Вперед
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 p-6 text-sm text-gray-600 space-y-3">
              <p>
                Загрузите реестр <strong>{viewRegistry === 'vsm' ? 'ВСМ' : 'СК'}</strong> кнопкой «Загрузить Реестр по
                Билетам» — данные сохранятся в программе (SQLite) и останутся после перезапуска.
              </p>
              <p>
                Сопоставление с Базой: колонка <strong>J «Паспорт»</strong> ↔ <strong>C+D</strong> Основной Базы; шаги:
                точное по паспорту → по номеру D → точное/нечёткое по ФИО (кол. I ↔ B, латиница → кириллица) → нечёткое по паспорту (≥ 86%).
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
