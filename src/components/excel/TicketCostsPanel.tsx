'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useExcelApi } from '@/hooks/use-excel-api'
import { Button } from '@/components/ui/button'
import TicketCostsDashboardView, {
  TicketCostsFiltersBar,
  type TicketCostsDashboardData,
} from '@/components/excel/TicketCostsDashboardView'
import TicketCostsEditableGrid from '@/components/excel/TicketCostsEditableGrid'
import TicketCostsLoadSection from '@/components/excel/TicketCostsLoadSection'
import TicketCostsActionStatusBar from '@/components/excel/TicketCostsActionStatusBar'
import { useTicketCostsActionStatus } from '@/components/excel/useTicketCostsActionStatus'
import {
  buildDashboardFetchKey,
  getDashboardCache,
  invalidateTicketCostsCache,
  type TicketCostsFilterState,
} from '@/components/excel/ticketCostsCache'
import {
  REGISTRY_LABELS,
  TICKET_COSTS_EMPTY_HINT,
  type RegistryId,
} from '@/components/excel/ticketCostsRegistries'
import { LayoutDashboard, RefreshCw, Ticket } from 'lucide-react'

type MainSection = 'dashboard' | RegistryId
type RegistryTab = 'report' | 'load'

const EMPTY_FILTERS: TicketCostsFilterState = {
  year: '',
  month: '',
  ploshchadka: '',
  obosnovanie: '',
  organizaciya: '',
  klassifikaciya: '',
  aviaperevozchik: '',
}

interface RegistryStatus {
  processed_rows?: number
  raw_rows?: number
  deduped?: boolean
  db_path?: string
  table_processed?: string
  filters?: TicketCostsDashboardData['filters']
  stored_files?: Array<{
    file_id: string
    original_name: string
    uploaded_at?: string
    row_count?: number
  }>
  upload_queue?: Array<{
    id: string
    name: string
    path: string
    file_id?: string
    added_at?: string
  }>
  processing_runs?: Array<{
    run_id: string
    run_type: string
    label: string
    created_at: string
    row_count: number
    active?: number
  }>
}

function dashboardParams(f: TicketCostsFilterState) {
  const params: {
    year?: number
    month?: number
    ploshchadka?: string
    obosnovanie?: string
    organizaciya?: string
    klassifikaciya?: string
    aviaperevozchik?: string
  } = {}
  if (f.year) params.year = Number(f.year)
  if (f.month) params.month = Number(f.month)
  if (f.ploshchadka) params.ploshchadka = f.ploshchadka
  if (f.obosnovanie) params.obosnovanie = f.obosnovanie
  if (f.organizaciya) params.organizaciya = f.organizaciya
  if (f.klassifikaciya) params.klassifikaciya = f.klassifikaciya
  if (f.aviaperevozchik) params.aviaperevozchik = f.aviaperevozchik
  return params
}

export default function TicketCostsPanel() {
  const api = useExcelApi()
  const {
    status: dashStatus,
    reset: resetDashStatus,
    runAction: runDashAction,
  } = useTicketCostsActionStatus()
  const {
    status: loadActionStatus,
    reset: resetLoadActionStatus,
  } = useTicketCostsActionStatus({ persistent: true })

  const [mainSection, setMainSection] = useState<MainSection>('vsm')
  const [registryTab, setRegistryTab] = useState<RegistryTab>('report')
  const [dataRefreshKey, setDataRefreshKey] = useState(0)

  const [filters, setFilters] = useState<TicketCostsFilterState>(EMPTY_FILTERS)
  const [fuzzyFioPercent, setFuzzyFioPercent] = useState(90)
  const [status, setStatus] = useState<Record<string, RegistryStatus>>({})
  const [statusLoading, setStatusLoading] = useState(true)
  const [mountedReports, setMountedReports] = useState<Record<RegistryId, boolean>>({
    vsm: true,
    sk: false,
  })
  const [dashboard, setDashboard] = useState<TicketCostsDashboardData | null>(() =>
    getDashboardCache(buildDashboardFetchKey(EMPTY_FILTERS)),
  )
  const [error, setError] = useState<string | null>(null)
  const [filterOptionsByReg, setFilterOptionsByReg] = useState<
    Partial<Record<RegistryId, TicketCostsDashboardData['filters']>>
  >({})
  const [filtersLoading, setFiltersLoading] = useState(false)

  const filtersRef = useRef(filters)
  filtersRef.current = filters
  const statusRef = useRef(status)
  statusRef.current = status

  const dashboardKey = useMemo(() => buildDashboardFetchKey(filters), [filters])
  const loadingDash = Boolean(dashStatus?.active)

  const isRegistry = mainSection === 'vsm' || mainSection === 'sk'
  const registryId: RegistryId | null = isRegistry ? mainSection : null

  const refreshStatus = useCallback(async (background = false) => {
    const hasData = Object.keys(statusRef.current).length > 0
    if (!background && !hasData) {
      setStatusLoading(true)
    }
    try {
      const st = await Promise.race([
        api.ticketsCostsStatus(undefined, { light: background }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), background ? 15_000 : 45_000),
        ),
      ])
      const regs = (st as { registries?: Record<string, RegistryStatus> }).registries || {}
      setStatus(regs)
      return regs
    } catch {
      return statusRef.current
    } finally {
      setStatusLoading(false)
    }
  }, [api])

  const loadFilterOptions = useCallback(
    async (regs: RegistryId[] = ['vsm', 'sk']) => {
      const toLoad = regs.filter((r) => (statusRef.current[r]?.processed_rows ?? 0) > 0)
      if (!toLoad.length) return
      setFiltersLoading(true)
      try {
        const entries = await Promise.all(
          toLoad.map(async (reg) => {
            const raw = await api.ticketsCostsFilterOptions(reg)
            return [reg, raw as TicketCostsDashboardData['filters']] as const
          }),
        )
        setFilterOptionsByReg((prev) => {
          const next = { ...prev }
          for (const [reg, opts] of entries) next[reg] = opts
          return next
        })
      } catch (e) {
        console.error('filter options:', e)
      } finally {
        setFiltersLoading(false)
      }
    },
    [api],
  )

  const prepareClearForRegistry = useCallback(async (reg: RegistryId) => {
    setMountedReports((prev) => ({ ...prev, [reg]: false }))
    if (mainSection === reg) {
      setRegistryTab('load')
    }
  }, [mainSection])

  useEffect(() => {
    const onPrepare = (e: Event) => {
      const reg = (e as CustomEvent<{ registry: RegistryId }>).detail?.registry
      if (!reg) return
      setMountedReports((prev) => ({ ...prev, [reg]: false }))
      if (mainSection === reg) setRegistryTab('load')
    }
    window.addEventListener('omik-tickets-prepare-clear', onPrepare)
    return () => window.removeEventListener('omik-tickets-prepare-clear', onPrepare)
  }, [mainSection])

  const prefetchDashboard = useCallback(
    async (f: TicketCostsFilterState) => {
      const key = buildDashboardFetchKey(f)
      const hit = getDashboardCache(key)
      if (hit) {
        setDashboard(hit)
        return hit
      }
      const data = await api.ticketsCostsDashboard(dashboardParams(f))
      const typed = data as TicketCostsDashboardData
      setDashboard(typed)
      return typed
    },
    [api],
  )

  const loadDashboardWithUi = useCallback(
    async (filterOverride?: Partial<TicketCostsFilterState>) => {
      setError(null)
      const nextApplied = { ...filtersRef.current, ...filterOverride }
      setFilters(nextApplied)
      try {
        await runDashAction(
          'Загрузка дашборда',
          ['Сбор фильтров', 'Агрегация KPI', 'Построение графиков'],
          async ({ advance, startElapsedTimer }) => {
            startElapsedTimer('Дашборд')
            advance()
            advance()
            const data = await prefetchDashboard(nextApplied)
            advance()
            const tickets = data?.kpi?.ticket_count
            return tickets != null
              ? `Билетов в выборке: ${tickets.toLocaleString('ru-RU')}`
              : 'Дашборд обновлён'
          },
        )
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка дашборда')
      }
    },
    [runDashAction, prefetchDashboard],
  )

  useEffect(() => {
    void (async () => {
      await refreshStatus(false)
      await loadFilterOptions()
    })()
  }, [refreshStatus, loadFilterOptions])

  useEffect(() => {
    if (registryId && registryTab === 'report') {
      setMountedReports((prev) => (prev[registryId] ? prev : { ...prev, [registryId]: true }))
    }
  }, [registryId, registryTab])

  useEffect(() => {
    const hit = getDashboardCache(dashboardKey)
    if (hit) setDashboard(hit)
  }, [dashboardKey])

  const processedTotal = (status.vsm?.processed_rows ?? 0) + (status.sk?.processed_rows ?? 0)

  useEffect(() => {
    if (mainSection !== 'dashboard') return
    const t = setTimeout(() => {
      void prefetchDashboard(filters).catch((e) => {
        setError(e instanceof Error ? e.message : 'Ошибка дашборда')
      })
    }, 300)
    return () => clearTimeout(t)
  }, [mainSection, filters, processedTotal, prefetchDashboard])

  const bumpData = useCallback(() => {
    invalidateTicketCostsCache()
    setDataRefreshKey((k) => k + 1)
    void (async () => {
      await refreshStatus(false)
      await loadFilterOptions()
    })()
    void prefetchDashboard(filtersRef.current).catch((e) => {
      setError(e instanceof Error ? e.message : 'Ошибка дашборда')
    })
  }, [refreshStatus, loadFilterOptions, prefetchDashboard])

  const commitFilter = useCallback((patch: Partial<TicketCostsFilterState>) => {
    const next = { ...filtersRef.current, ...patch }
    setFilters(next)
    filtersRef.current = next
    invalidateTicketCostsCache()
    setDataRefreshKey((k) => k + 1)
  }, [])

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS)
    filtersRef.current = EMPTY_FILTERS
    invalidateTicketCostsCache()
    setDataRefreshKey((k) => k + 1)
  }

  const exportDashboardCsv = async () => {
    try {
      const res = await api.ticketsCostsData({
        registry: mainSection === 'vsm' || mainSection === 'sk' ? mainSection : undefined,
        limit: 0,
        year: filters.year ? Number(filters.year) : undefined,
        month: filters.month ? Number(filters.month) : undefined,
        podrazdelenie: filters.ploshchadka || undefined,
        obosnovanie: filters.obosnovanie || undefined,
      })
      const cols = (res as { columns?: { key: string; title: string }[] }).columns || []
      const rows = (res as { data?: Record<string, unknown>[] }).data || []
      const header = cols.map((c) => c.title).join(';')
      const body = rows.map((r) => cols.map((c) => String(r[c.key] ?? '').replace(/;/g, ',')).join(';')).join('\n')
      const blob = new Blob(['\ufeff' + header + '\n' + body], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `zatraty_bilety_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка экспорта')
    }
  }

  const registryStatus = registryId ? status[registryId] : undefined
  const registryFilterOptions = useMemo(() => {
    const fromDedicated = registryId ? filterOptionsByReg[registryId] : undefined
    const fromStatus = registryStatus?.filters
    const fromDash = dashboard?.filters
    const hasLists = (f?: TicketCostsDashboardData['filters']) =>
      Boolean(
        f?.years?.length
        || f?.months?.length
        || f?.podrazdeleniya?.length
        || f?.organizacii?.length,
      )
    if (hasLists(fromDedicated)) return fromDedicated
    if (isRegistry && hasLists(fromStatus)) return fromStatus
    if (hasLists(fromDash)) return fromDash
    if (mainSection === 'dashboard') {
      const merged = {
        years: [...new Set([...(fromDedicated?.years || []), ...(fromDash?.years || [])])].sort(),
        months: [...new Set([...(fromDedicated?.months || []), ...(fromDash?.months || [])])].sort(),
        podrazdeleniya: fromDedicated?.podrazdeleniya?.length
          ? fromDedicated.podrazdeleniya
          : fromDash?.podrazdeleniya || [],
        obosnovaniya: fromDedicated?.obosnovaniya?.length
          ? fromDedicated.obosnovaniya
          : fromDash?.obosnovaniya || [],
        organizacii: fromDedicated?.organizacii?.length
          ? fromDedicated.organizacii
          : fromDash?.organizacii || [],
        klassifikacii: fromDedicated?.klassifikacii?.length
          ? fromDedicated.klassifikacii
          : fromDash?.klassifikacii || [],
        aviaperevozchiki: fromDedicated?.aviaperevozchiki?.length
          ? fromDedicated.aviaperevozchiki
          : fromDash?.aviaperevozchiki || [],
      }
      if (hasLists(merged)) return merged
    }
    return fromDedicated ?? fromStatus ?? fromDash
  }, [
    isRegistry,
    registryId,
    filterOptionsByReg,
    registryStatus?.filters,
    dashboard?.filters,
    mainSection,
  ])

  const showDashStatusBar =
    dashStatus?.active || dashStatus?.success || dashStatus?.error

  const showLoadStatusBar =
    (loadActionStatus?.active || loadActionStatus?.success || loadActionStatus?.error) &&
    registryTab !== 'load'

  const tableLoadBlocked = Boolean(loadActionStatus?.active)

  const panelClass = (active: boolean) =>
    active ? 'flex flex-col flex-1 min-h-0' : 'hidden flex-col flex-1 min-h-0'

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-50">
      <div className="border-b border-gray-200 bg-white px-4 py-3 space-y-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow">
            <Ticket className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-800">Затраты по билетам</h2>
            <p className="text-[11px] text-gray-500">Дашборд • таблица A–U • загрузка и история обработок</p>
          </div>
          <Button size="sm" variant="outline" className="h-8 ml-auto" onClick={() => void refreshStatus(false)}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Обновить
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {([
            ['dashboard', 'Дашборд', LayoutDashboard],
            ['vsm', REGISTRY_LABELS.vsm, Ticket],
            ['sk', REGISTRY_LABELS.sk, Ticket],
          ] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setMainSection(id as MainSection)
                setError(null)
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 ${
                mainSection === id
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {isRegistry && registryId && (
          <div className="flex flex-wrap gap-2 items-center">
            {([
              ['report', 'Таблица данных'],
              ['load', 'Загрузить и обработать'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setRegistryTab(id)}
                className={`px-2.5 py-1 rounded text-[11px] border ${
                  registryTab === id
                    ? 'bg-violet-50 border-violet-300 text-violet-800'
                    : 'bg-white border-gray-200 text-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
            <span className="text-[10px] text-gray-500 ml-1">
              {statusLoading && !registryStatus
                ? 'обновление статуса…'
                : registryStatus?.processed_rows
                  ? `${registryStatus.processed_rows.toLocaleString('ru-RU')} строк в таблице`
                  : registryStatus?.raw_rows
                    ? `${registryStatus.raw_rows.toLocaleString('ru-RU')} сырых`
                    : 'нет данных'}
            </span>
          </div>
        )}

        {(mainSection === 'dashboard' || (isRegistry && registryTab === 'report')) && (
          <TicketCostsFiltersBar
            filterOptions={registryFilterOptions}
            year={filters.year}
            month={filters.month}
            podrazdelenie={filters.ploshchadka}
            obosnovanie={filters.obosnovanie}
            organizaciya={filters.organizaciya}
            klassifikaciya={filters.klassifikaciya}
            aviaperevozchik={filters.aviaperevozchik}
            onYear={(v) => commitFilter({ year: v })}
            onMonth={(v) => commitFilter({ month: v })}
            onPodrazdelenie={(v: string) => commitFilter({ ploshchadka: v })}
            onApply={() => undefined}
            onObosnovanie={(v) => commitFilter({ obosnovanie: v })}
            onOrganizaciya={(v) => commitFilter({ organizaciya: v })}
            onKlassifikaciya={(v) => commitFilter({ klassifikaciya: v })}
            onAviaperevozchik={(v) => commitFilter({ aviaperevozchik: v })}
            onReset={() => resetFilters()}
            onRefresh={() => {
              void (async () => {
                await refreshStatus(false)
                await loadFilterOptions(registryId ? [registryId] : ['vsm', 'sk'])
                if (mainSection === 'dashboard') void loadDashboardWithUi()
                else bumpData()
              })()
            }}
            onExport={() => void exportDashboardCsv()}
          />
        )}

        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">{error}</div>
        )}

        {showLoadStatusBar && (
          <TicketCostsActionStatusBar
            status={loadActionStatus}
            onDismiss={() => resetLoadActionStatus()}
          />
        )}

        {showDashStatusBar && (
          <TicketCostsActionStatusBar
            status={dashStatus}
            onDismiss={() => resetDashStatus()}
            compact
          />
        )}
      </div>

      <div className="flex flex-col flex-1 min-h-0 relative">
        <div className={panelClass(mainSection === 'dashboard')}>
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            <TicketCostsDashboardView
              dashboard={dashboard}
              loading={loadingDash && !dashboard}
              emptyHint={TICKET_COSTS_EMPTY_HINT}
              onFilterPodrazdelenie={(v: string) => commitFilter({ ploshchadka: v })}
              onFilterCarrier={(v) => commitFilter({ aviaperevozchik: v })}
            />
          </div>
        </div>

        <div className={panelClass(registryId === 'vsm' && registryTab === 'report') + ' p-4'}>
          {mountedReports.vsm && (
            <TicketCostsEditableGrid
              registry="vsm"
              filters={filters}
              refreshKey={dataRefreshKey}
              processedRowsHint={status.vsm?.processed_rows}
              statusPending={statusLoading}
              active={registryId === 'vsm' && registryTab === 'report'}
              loadInProgress={tableLoadBlocked}
              fuzzyFioPercent={fuzzyFioPercent}
              onFuzzyPercentChange={setFuzzyFioPercent}
              onDataChanged={bumpData}
              dbHint={
                status.vsm?.db_path
                  ? `${status.vsm.db_path} → ${status.vsm.table_processed || 'processed'}`
                  : undefined
              }
            />
          )}
        </div>

        <div className={panelClass(registryId === 'sk' && registryTab === 'report') + ' p-4'}>
          {mountedReports.sk && (
            <TicketCostsEditableGrid
              registry="sk"
              filters={filters}
              refreshKey={dataRefreshKey}
              processedRowsHint={status.sk?.processed_rows}
              statusPending={statusLoading}
              active={registryId === 'sk' && registryTab === 'report'}
              loadInProgress={tableLoadBlocked}
              fuzzyFioPercent={fuzzyFioPercent}
              onFuzzyPercentChange={setFuzzyFioPercent}
              onDataChanged={bumpData}
              dbHint={
                status.sk?.db_path
                  ? `${status.sk.db_path} → ${status.sk.table_processed || 'processed'}`
                  : undefined
              }
            />
          )}
        </div>

        <div className={panelClass(isRegistry && registryTab === 'load' && registryId === 'vsm') + ' min-h-0 overflow-y-auto p-4'}>
          <TicketCostsLoadSection
            registry="vsm"
            showActionStatusBar={mainSection === 'vsm' && registryTab === 'load'}
            storedFiles={status.vsm?.stored_files || []}
            uploadQueue={status.vsm?.upload_queue || []}
            processingRuns={status.vsm?.processing_runs || []}
            statusLoading={statusLoading && !status.vsm}
            rawRows={status.vsm?.raw_rows ?? 0}
            fuzzyFioPercent={fuzzyFioPercent}
            onFuzzyPercentChange={setFuzzyFioPercent}
            onRefreshStatus={refreshStatus}
            onDataChanged={bumpData}
            onOpenTable={() => {
              setMainSection('vsm')
              setRegistryTab('report')
            }}
            onPrepareClear={prepareClearForRegistry}
          />
        </div>

        <div className={panelClass(isRegistry && registryTab === 'load' && registryId === 'sk') + ' min-h-0 overflow-y-auto p-4'}>
          <TicketCostsLoadSection
            registry="sk"
            showActionStatusBar={mainSection === 'sk' && registryTab === 'load'}
            storedFiles={status.sk?.stored_files || []}
            uploadQueue={status.sk?.upload_queue || []}
            processingRuns={status.sk?.processing_runs || []}
            statusLoading={statusLoading && !status.sk}
            rawRows={status.sk?.raw_rows ?? 0}
            fuzzyFioPercent={fuzzyFioPercent}
            onFuzzyPercentChange={setFuzzyFioPercent}
            onRefreshStatus={refreshStatus}
            onDataChanged={bumpData}
            onOpenTable={() => {
              setMainSection('sk')
              setRegistryTab('report')
            }}
            onPrepareClear={prepareClearForRegistry}
          />
        </div>
      </div>
    </div>
  )
}
