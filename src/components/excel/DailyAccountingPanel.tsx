'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useExcelApi } from '@/hooks/use-excel-api'
import type { DailySiteItem } from '@/hooks/excel-api/daily'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import FilterableDataTable from '@/components/excel/FilterableDataTable'
import DailyAccountingBulkUpload from '@/components/excel/DailyAccountingBulkUpload'
import DailyAccountingDashboard from '@/components/excel/DailyAccountingDashboard'
import DailyAccountingValidationDialog, {
  type DailyValidationError,
} from '@/components/excel/DailyAccountingValidationDialog'
import DailyAccountingValidationSummary, {
  type DailyValidationScopeResult,
} from '@/components/excel/DailyAccountingValidationSummary'
import TicketCostsActionStatusBar from '@/components/excel/TicketCostsActionStatusBar'
import { useDailyActionStatus } from '@/hooks/use-daily-action-status'
import { useAppUser } from '@/hooks/use-app-user'
import { canAccessSite, hasFullSiteAccess, type AppUser } from '@/lib/app-auth'
import {
  dailyCacheFetch,
  dailyCacheGet,
  dailyCacheHas,
  dailyCacheInvalidate,
  dailyCacheIsLoading,
  dailyCacheKey,
  dailyCacheSet,
} from '@/lib/daily-accounting-cache'
import {
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react'

type TabId = 'dashboard' | 'combined' | string

const DAILY_COLUMNS = [
  { key: 'location_id', title: 'Площадка' },
  { key: 'region', title: 'Регион' },
  { key: 'location_name_1c', title: 'Площадка 1С' },
  { key: 'tab_number', title: 'Таб. №' },
  { key: 'fio', title: 'Ф.И.О.' },
  { key: 'birth_date_1c', title: 'Дата рождения' },
  { key: 'citizenship', title: 'Гражданство' },
  { key: 'passport_series_1c', title: 'Серия паспорта' },
  { key: 'passport_number_1c', title: 'Номер паспорта' },
  { key: 'actual_position', title: 'Должность' },
  { key: 'section', title: 'Участок' },
  { key: 'visa', title: 'Явка' },
  { key: 'visa_type', title: 'Тип явки' },
  { key: 'region2', title: 'Регион 2' },
  { key: 'visa_expiry', title: 'Срок вахты' },
  { key: 'entry_date', title: 'Дата въезда' },
  { key: 'status', title: 'Статус' },
] as const

function formatDateRu(iso: string) {
  if (!iso) return ''
  try {
    const [y, m, d] = iso.split('-').map(Number)
    if (y && m && d) {
      return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`
    }
    return new Date(`${iso}T12:00:00`).toLocaleDateString('ru-RU')
  } catch {
    return iso
  }
}

function SiteTable({
  date,
  site,
  combined,
  showSiteColumn,
  rows,
  loading,
  onUpload,
  uploadDisabled,
  clearDisabled,
  validateDisabled,
  user,
  canExport,
  onClear,
  onValidate,
  validating,
  actionBusy,
}: {
  date: string
  site: string
  combined: boolean
  showSiteColumn: boolean
  rows: Record<string, unknown>[]
  loading: boolean
  onUpload: (file: File) => void
  uploadDisabled: boolean
  clearDisabled: boolean
  validateDisabled: boolean
  user: AppUser | null
  canExport: boolean
  onClear: () => void | Promise<void>
  onValidate: () => void
  validating: boolean
  actionBusy: boolean
}) {
  const api = useExcelApi()
  const [clearing, setClearing] = useState(false)

  const columns = useMemo(
    () => (showSiteColumn ? [...DAILY_COLUMNS] : DAILY_COLUMNS.filter((c) => c.key !== 'location_id')),
    [showSiteColumn],
  )

  const title = combined
    ? `Ежедневный учёт — Общий — ${formatDateRu(date)}`
    : `Ежедневный учёт — ${site || '—'} — ${formatDateRu(date)}`

  const handleClear = async () => {
    if (!user) return
    if (!combined && !site) return
    const ok = combined
      ? window.confirm(
          `Удалить сформированный «Общий» отчёт за ${formatDateRu(date)}?\n\nДанные по отдельным площадкам не удаляются.`,
        )
      : window.confirm(
          `Удалить все данные и загруженный файл за ${formatDateRu(date)} по площадке «${site}»?`,
        )
    if (!ok) return
    setClearing(true)
    try {
      await onClear()
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 w-full h-full gap-2">
      <div className="flex flex-wrap gap-2 shrink-0">
        {!combined && (
          <label className="inline-flex">
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              disabled={uploadDisabled || loading || clearing || actionBusy}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onUpload(f)
                e.target.value = ''
              }}
            />
            <Button
              size="sm"
              className="h-8"
              disabled={uploadDisabled || loading || clearing || actionBusy}
              asChild
            >
              <span>
                <Upload className="h-3.5 w-3.5 mr-1" />
                Загрузить XLSX
              </span>
            </Button>
          </label>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8"
          disabled={validateDisabled || validating || loading || actionBusy}
          onClick={onValidate}
        >
          <ClipboardCheck className="h-3.5 w-3.5 mr-1" />
          {validating ? 'Проверка…' : 'Проверить отчёт'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-red-700 border-red-200 hover:bg-red-50"
          disabled={clearDisabled || loading || clearing || actionBusy}
          onClick={() => void handleClear()}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          {clearing ? 'Очистка…' : 'Очистить данные'}
        </Button>
      </div>
      <div className="flex-1 min-h-0 min-w-0 w-full border border-gray-200 rounded-lg bg-white flex flex-col overflow-hidden">
        <FilterableDataTable
          title={title}
          columns={columns}
          rows={rows}
          exportFileName={`Ежедневный_учет_${date}`}
          maxHeight="flex-1 min-h-[200px]"
          className="flex-1 min-h-0 h-full"
          headerVariant="amber"
          wideTable
          serverExport={
            canExport
              ? () =>
                  api.dailyExport({
                    date,
                    locationId: combined ? undefined : site,
                    combined,
                    fileName: `Ежедневный_учет_${date}${site ? `_${site}` : '_Общий'}.xlsx`,
                  })
              : undefined
          }
          serverExportTitle="Выгрузка по шаблону (ДД.ММ.ГГГГ)"
          emptyMessage={
            loading && rows.length === 0
              ? 'Загрузка…'
              : combined
                ? 'Нет данных. Нажмите «Создать Общий отчёт».'
                : 'Нет данных. Загрузите файл «ЕЖЕДНЕВНЫЙ УЧЕТ».'
          }
        />
      </div>
    </div>
  )
}

export default function DailyAccountingPanel() {
  const api = useExcelApi()
  const {
    status: actionStatus,
    reset: resetActionStatus,
    runAction,
    showResult,
    stop: stopAction,
  } = useDailyActionStatus()
  const actionBusy = Boolean(actionStatus?.active)
  const actionAbortRef = useRef<() => void>(() => {})
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [siteItems, setSiteItems] = useState<DailySiteItem[]>([])
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [refreshKey, setRefreshKey] = useState(0)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [newSiteName, setNewSiteName] = useState('')
  const [sitesLoading, setSitesLoading] = useState(false)
  const [combinedReady, setCombinedReady] = useState(false)
  const [buildingCombined, setBuildingCombined] = useState(false)
  const [validating, setValidating] = useState(false)
  const [validationOpen, setValidationOpen] = useState(false)
  const [validationTitle, setValidationTitle] = useState('')
  const [validationErrors, setValidationErrors] = useState<DailyValidationError[]>([])
  const [validationRowCount, setValidationRowCount] = useState(0)
  const [validationSummary, setValidationSummary] = useState<
    Record<string, Omit<DailyValidationScopeResult, 'canValidate'>>
  >({})
  const [validationSummaryScope, setValidationSummaryScope] = useState<string | null>(null)
  const [cacheTick, setCacheTick] = useState(0)
  const bumpCache = useCallback(() => setCacheTick((t) => t + 1), [])
  const tabsRef = React.useRef<HTMLDivElement>(null)

  const { user, ready: authReady } = useAppUser()
  const fullAccess = hasFullSiteAccess(user)

  const visibleSites = useMemo(() => {
    const active = siteItems.filter((s) => s.opStatus === 'active')
    if (!user || fullAccess) return active
    return active.filter((s) => canAccessSite(user, s.name))
  }, [siteItems, user, fullAccess])

  const invalidateCache = useCallback(
    (prefix?: string) => {
      dailyCacheInvalidate(prefix)
      bumpCache()
    },
    [bumpCache],
  )

  const fetchIntoCache = useCallback(
    async (key: string, loader: () => Promise<Record<string, unknown>[]>) =>
      dailyCacheFetch(key, loader, bumpCache),
    [bumpCache],
  )

  const runDailyAction = useCallback(
    (
      title: string,
      stepLabels: string[],
      runner: Parameters<typeof runAction>[2],
    ) =>
      runAction(title, stepLabels, async (api) => {
        actionAbortRef.current = api.checkAborted
        try {
          return await runner(api)
        } finally {
          actionAbortRef.current = () => {}
        }
      }),
    [runAction],
  )

  const fetchSitesList = useCallback(async () => {
    const { items, sites: names } = await api.dailySites(true, true)
    return items?.length
      ? items.filter((i) => i.opStatus === 'active')
      : names.map((name) => ({
          name,
          opStatus: 'active' as const,
          statusLabel: 'Актив.',
        }))
  }, [api])

  const reloadAllData = useCallback(async () => {
    setSitesLoading(true)
    try {
      await runDailyAction(
        `Данные за ${formatDateRu(date)}`,
        ['Справочник площадок', 'Загрузка таблиц', 'Общий отчёт'],
        async ({ advance, setDetail, startElapsedTimer, checkAborted }) => {
          advance('Список ОП')
          checkAborted()
          const list = await fetchSitesList()
          setSiteItems(list)
          advance('Загрузка по площадкам')
          startElapsedTimer('Чтение')
          let i = 0
          for (const s of list) {
            checkAborted()
            i += 1
            setDetail(`${s.name} (${i}/${list.length})`)
            const key = dailyCacheKey(date, s.name, false)
            await fetchIntoCache(key, async () => {
              const res = await api.dailyList({ date, locationId: s.name, limit: 50_000 })
              return res.data || []
            })
          }
          if (fullAccess) {
            advance('Статус «Общий»')
            const res = await api.dailyList({ date, combined: true, limit: 1 })
            const ready = Boolean(res.hasCombined || (res.data?.length ?? 0) > 0)
            setCombinedReady(ready)
            if (ready) {
              setDetail('Загрузка «Общий»')
              const key = dailyCacheKey(date, '', true)
              await fetchIntoCache(key, async () => {
                const full = await api.dailyList({ date, combined: true, limit: 50_000 })
                return full.data || []
              })
            }
          } else {
            setCombinedReady(false)
          }
          return `Загружено: ${list.length} площадок`
        },
      )
    } catch {
      /* runAction уже показал ошибку */
    } finally {
      setSitesLoading(false)
    }
  }, [api, date, fetchIntoCache, fetchSitesList, fullAccess, runDailyAction])

  useEffect(() => {
    invalidateCache(`${date}|`)
    setCombinedReady(false)
    setValidationSummary({})
    setValidationSummaryScope(null)
  }, [date, refreshKey, invalidateCache])

  useEffect(() => {
    if (!date) return
    void reloadAllData()
  }, [date, refreshKey, reloadAllData])

  useEffect(() => {
    if (activeTab === 'dashboard' || activeTab === 'combined') return
    const ok = visibleSites.some((s) => s.name === activeTab)
    if (!ok && visibleSites.length) setActiveTab(visibleSites[0]!.name)
    else if (!ok) setActiveTab('dashboard')
  }, [activeTab, visibleSites])

  const bumpRefresh = () => setRefreshKey((k) => k + 1)

  const getCachedRows = (site: string, combined: boolean) => {
    void cacheTick
    return dailyCacheGet(dailyCacheKey(date, site, combined)) ?? []
  }

  const isLoadingKey = (site: string, combined: boolean) => {
    void cacheTick
    const key = dailyCacheKey(date, site, combined)
    return dailyCacheIsLoading(key)
  }

  const siteTableLoading = (site: string, combined: boolean) => {
    const rows = getCachedRows(site, combined)
    return isLoadingKey(site, combined) && rows.length === 0
  }

  const persistValidationResult = useCallback(
    (
      scopeId: string,
      label: string,
      combined: boolean,
      locationId: string | undefined,
      res: {
        errors?: DailyValidationError[]
        errorCount?: number
        hasErrors?: boolean
        rowCount?: number
      } | null,
      loadError?: string,
    ) => {
      setValidationSummary((prev) => ({
        ...prev,
        [scopeId]: {
          scopeId,
          label,
          combined,
          rowCount: res?.rowCount ?? 0,
          errorCount: res?.errorCount ?? res?.errors?.length ?? 0,
          hasErrors: Boolean(res?.hasErrors),
          errors: res?.errors ?? [],
          checkedAt: Date.now(),
          loadError,
        },
      }))
    },
    [],
  )

  const runValidateInner = useCallback(
    async (opts: {
      locationId?: string
      combined?: boolean
      title: string
      showDialog?: boolean
    }) => {
      const scopeId = opts.combined ? '__combined__' : (opts.locationId ?? '')
      const label = opts.combined ? 'Общий' : (opts.locationId ?? opts.title)
      const res = await api.dailyValidate({
        date,
        locationId: opts.locationId,
        combined: opts.combined,
      })
      persistValidationResult(scopeId, label, Boolean(opts.combined), opts.locationId, res)
      if (opts.showDialog !== false) {
        setValidationTitle(opts.title)
        setValidationErrors(res.errors || [])
        setValidationRowCount(res.rowCount ?? 0)
        setValidationOpen(true)
      }
      return res
    },
    [api, date, persistValidationResult],
  )

  const runValidate = useCallback(
    async (opts: {
      locationId?: string
      combined?: boolean
      title: string
      showDialog?: boolean
      quiet?: boolean
    }) => {
      const scopeId = opts.combined ? '__combined__' : (opts.locationId ?? '')
      const label = opts.combined ? 'Общий' : (opts.locationId ?? opts.title)

      const finishMessage = (res: Awaited<ReturnType<typeof runValidateInner>> | null) => {
        if (!res) return
        const warn = (res as { warning?: string }).warning
        if (warn) return warn
        if (res.hasErrors) return `Найдено ${res.errorCount} ошибок`
        return 'Ошибок не найдено'
      }

      if (opts.quiet) {
        try {
          return await runValidateInner(opts)
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : 'Ошибка проверки'
          persistValidationResult(
            scopeId,
            label,
            Boolean(opts.combined),
            opts.locationId,
            null,
            errMsg,
          )
          return null
        }
      }

      setValidating(true)
      let result: Awaited<ReturnType<typeof runValidateInner>> | null = null
      try {
        await runDailyAction(
          opts.title,
          ['Чтение данных', 'Проверка_3/4 — задвоения', 'Проверка_1/2 — Основная БД', 'Итог'],
          async ({ advance }) => {
            advance('Загрузка строк отчёта')
            try {
              result = await runValidateInner({ ...opts, showDialog: opts.showDialog })
            } catch (e) {
              const errMsg = e instanceof Error ? e.message : 'Ошибка проверки'
              persistValidationResult(
                scopeId,
                label,
                Boolean(opts.combined),
                opts.locationId,
                null,
                errMsg,
              )
              throw e
            }
            advance('Формирование результата')
            return finishMessage(result) ?? 'Готово'
          },
        )
        return result
      } catch {
        return null
      } finally {
        setValidating(false)
      }
    },
    [persistValidationResult, runDailyAction, runValidateInner],
  )

  const canValidateSite = useCallback(
    (siteName: string) => Boolean(user && (fullAccess || canAccessSite(user, siteName))),
    [user, fullAccess],
  )

  const validationScopes = useMemo((): DailyValidationScopeResult[] => {
    const list: DailyValidationScopeResult[] = visibleSites.map((s) => {
      const stored = validationSummary[s.name]
      return {
        scopeId: s.name,
        label: s.name,
        combined: false,
        canValidate: canValidateSite(s.name),
        rowCount: stored?.rowCount ?? 0,
        errorCount: stored?.errorCount ?? 0,
        hasErrors: stored?.hasErrors ?? false,
        errors: stored?.errors ?? [],
        checkedAt: stored?.checkedAt,
        loadError: stored?.loadError,
      }
    })
    if (fullAccess && combinedReady) {
      const stored = validationSummary.__combined__
      list.unshift({
        scopeId: '__combined__',
        label: 'Общий',
        combined: true,
        canValidate: Boolean(user && fullAccess),
        rowCount: stored?.rowCount ?? 0,
        errorCount: stored?.errorCount ?? 0,
        hasErrors: stored?.hasErrors ?? false,
        errors: stored?.errors ?? [],
        checkedAt: stored?.checkedAt,
        loadError: stored?.loadError,
      })
    }
    return list
  }, [visibleSites, validationSummary, fullAccess, combinedReady, user, canValidateSite])

  const totalValidationErrors = useMemo(
    () => validationScopes.reduce((n, s) => n + (s.checkedAt ? s.errorCount : 0), 0),
    [validationScopes],
  )

  const runAllValidations = useCallback(async () => {
    const scopes: { id: string; combined: boolean; label: string }[] = visibleSites
      .filter((s) => canValidateSite(s.name))
      .map((s) => ({ id: s.name, combined: false, label: s.name }))
    if (fullAccess && combinedReady) {
      scopes.unshift({ id: '__combined__', combined: true, label: 'Общий' })
    }
    if (!scopes.length) {
      showResult('Нет доступных площадок для проверки', { title: 'Проверка всех' })
      return
    }

    setValidating(true)
    let totalErrors = 0
    try {
      await runDailyAction(
        'Проверка всех площадок',
        ['Подготовка', ...scopes.map((s) => `Проверка: ${s.label}`), 'Итог'],
        async ({ advance }) => {
          for (const s of scopes) {
            advance(s.label)
            const res = await runValidate({
              locationId: s.combined ? undefined : s.id,
              combined: s.combined,
              title: s.combined
                ? `Проверка — Общий — ${formatDateRu(date)}`
                : `Проверка — ${s.label}`,
              showDialog: false,
              quiet: true,
            })
            if (res) totalErrors += res.errorCount ?? 0
          }
          setActiveTab('validation-summary')
          return totalErrors > 0
            ? `Найдено ${totalErrors.toLocaleString('ru-RU')} ошибок — см. «Итог проверок»`
            : 'Ошибок не найдено'
        },
      )
    } catch {
      /* статус-бар показал ошибку */
    } finally {
      setValidating(false)
    }
  }, [
    visibleSites,
    canValidateSite,
    runValidate,
    fullAccess,
    combinedReady,
    date,
    runDailyAction,
    showResult,
  ])

  const runValidateScope = useCallback(
    (scopeId: string) => {
      if (scopeId === '__combined__') {
        void runValidate({
          combined: true,
          title: `Проверка — Общий — ${formatDateRu(date)}`,
          showDialog: false,
        })
        return
      }
      void runValidate({
        locationId: scopeId,
        title: `Проверка — ${scopeId}`,
        showDialog: false,
      })
    },
    [runValidate, date],
  )

  useEffect(() => {
    if (!user || !date || !authReady) return
    const alertKey = `daily-combined-alert-${user.login}-${date}`
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(alertKey)) return

    void (async () => {
      try {
        const list = await api.dailyList({ date, combined: true, limit: 1 })
        if (!list.hasCombined && !(list.data?.length ?? 0)) return
        const res = await api.dailyValidate({ date, combined: true })
        persistValidationResult('__combined__', 'Общий', true, undefined, res)
        if (res.hasErrors) {
          sessionStorage.setItem(alertKey, '1')
          setValidationTitle(`Общий отчёт — ${formatDateRu(date)} — требуется исправление`)
          setValidationErrors(res.errors || [])
          setValidationRowCount(res.rowCount ?? 0)
          setValidationOpen(true)
          showResult('В «Общий» отчёте обнаружены ошибки. См. «Итог проверок».', {
            title: 'Автопроверка',
          })
        }
      } catch {
        /* ignore */
      }
    })()
  }, [user, date, authReady, refreshKey, api, persistValidationResult, showResult])

  useEffect(() => {
    if (!user || !date || fullAccess) return
    void (async () => {
      for (const s of visibleSites) {
        try {
          const res = await api.dailyValidate({ date, locationId: s.name })
          persistValidationResult(s.name, s.name, false, s.name, res)
          if (res.hasErrors) {
            showResult(
              `На площадке «${s.name}» найдено ${res.errorCount} ошибок — см. «Итог проверок»`,
              { title: 'Автопроверка' },
            )
            break
          }
        } catch {
          /* ignore */
        }
      }
    })()
  }, [user, date, visibleSites, fullAccess, refreshKey, api, persistValidationResult, showResult])

  const onUploadForSite = async (site: string, file: File) => {
    if (!user) {
      showResult('Войдите на главном экране', { error: true })
      return
    }
    if (!canAccessSite(user, site)) {
      showResult(`Нет прав на площадку «${site}»`, { error: true })
      return
    }
    try {
      await runDailyAction(
        `Загрузка — ${site}`,
        ['Отправка файла', 'Запись в базу', 'Проверка отчёта'],
        async ({ advance, setDetail, checkAborted }) => {
          checkAborted()
          setDetail(file.name)
          advance('Загрузка на сервер')
          const res = await api.dailyUpload({
            file,
            locationId: site,
            date,
            replaceSiteDate: true,
            user,
          })
          invalidateCache(`${date}|${site}`)
          invalidateCache(`${date}|__combined__`)
          setCombinedReady(false)
          bumpRefresh()
          advance('Проверка')
          await runValidate({
            locationId: site,
            title: `Проверка — ${site}`,
            showDialog: false,
            quiet: true,
          })
          return `Загружено: ${file.name} (${(res.rowCount ?? 0).toLocaleString('ru-RU')} чел.)`
        },
      )
    } catch {
      /* ошибка в статус-баре */
    }
  }

  const handleClearSite = useCallback(
    async (site: string, combined: boolean) => {
      if (!user) return
      await runDailyAction(
        combined ? 'Очистка «Общий»' : `Очистка — ${site}`,
        ['Удаление строк', 'Сброс кэша'],
        async ({ advance, checkAborted }) => {
          checkAborted()
          advance('Удаление…')
          const res = combined
            ? await api.dailyClear({ date, combined: true, user })
            : await api.dailyClear({ date, locationId: site, user })
          if (combined) {
            invalidateCache(`${date}|__combined__`)
            setCombinedReady(false)
          } else {
            invalidateCache(`${date}|${site}`)
            invalidateCache(`${date}|__combined__`)
            setCombinedReady(false)
          }
          bumpRefresh()
          return `Очищено: ${(res.deletedRows ?? 0).toLocaleString('ru-RU')} строк`
        },
      )
    },
    [api, bumpRefresh, date, invalidateCache, runDailyAction, user],
  )

  const buildCombined = async () => {
    if (!user || !fullAccess) return
    setBuildingCombined(true)
    try {
      await runDailyAction(
        'Создание «Общий» отчёта',
        ['Объединение площадок', 'Загрузка таблицы', 'Проверка'],
        async ({ advance, setDetail, checkAborted }) => {
          checkAborted()
          advance('Формирование')
          const res = await api.dailyBuildCombined(date, user)
          setDetail('Чтение данных')
          invalidateCache(`${date}|__combined__`)
          setCombinedReady(true)
          const key = dailyCacheKey(date, '', true)
          const full = await api.dailyList({ date, combined: true, limit: 50_000 })
          dailyCacheSet(key, full.data || [])
          bumpCache()
          advance('Проверка')
          const v = await runValidate({
            combined: true,
            title: `Проверка — Общий — ${formatDateRu(date)}`,
            showDialog: false,
            quiet: true,
          })
          const base = `Сформировано: ${(res.rowCount ?? 0).toLocaleString('ru-RU')} строк`
          if (v?.hasErrors) {
            return `${base}. Найдено ${v.errorCount} ошибок`
          }
          return base
        },
      )
    } catch {
      /* статус-бар */
    } finally {
      setBuildingCombined(false)
    }
  }

  const addSite = async () => {
    if (!user || !fullAccess) return
    const name = newSiteName.trim()
    if (!name) return
    try {
      await runDailyAction(
        'Добавление площадки',
        ['Запись в справочник', 'Обновление списка'],
        async ({ advance, checkAborted }) => {
          checkAborted()
          advance('Сохранение')
          const res = await api.dailyAddSite(name, user)
          if (res.sites) setSiteItems(res.sites)
          else {
            advance('Обновление списка')
            const list = await fetchSitesList()
            setSiteItems(list)
          }
          setNewSiteName('')
          setActiveTab(name)
          return `Площадка «${name}» добавлена`
        },
      )
    } catch {
      /* статус-бар */
    }
  }

  const uploadDisabledFor = (siteName: string) =>
    !user || (user ? !canAccessSite(user, siteName) : true)

  const scrollTabs = (dir: -1 | 1) => {
    tabsRef.current?.scrollBy({ left: dir * 200, behavior: 'smooth' })
  }

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 w-full overflow-hidden bg-gray-50">
      <div className="shrink-0 px-4 py-3 border-b border-gray-200 bg-white space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-gray-800">Ежедневный учёт</h2>
            <p className="text-[11px] text-gray-500 mt-0.5 max-w-3xl">
              Даты везде ДД.ММ.ГГГГ. Проверка_3/4 — задвоения; Проверка_1/2 — против Основной БД.
            </p>
          </div>
          {fullAccess && authReady && user && (
            <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => setBulkOpen(true)}>
              <Upload className="h-3.5 w-3.5 mr-1" />
              Массовая загрузка
            </Button>
          )}
        </div>

        {authReady && !user && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
            Для загрузки войдите на главном экране.
          </p>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-gray-500 text-xs">Дата</span>
            <Input type="date" className="h-8 w-40" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <span className="text-xs text-gray-500 pb-1">{formatDateRu(date)}</span>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            disabled={actionBusy || sitesLoading}
            onClick={() => bumpRefresh()}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${actionBusy || sitesLoading ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
          {fullAccess && user && (
            <div className="flex items-center gap-1">
              <Input
                className="h-8 w-48 text-xs"
                placeholder="Новая площадка (ОП)"
                value={newSiteName}
                onChange={(e) => setNewSiteName(e.target.value)}
              />
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => void addSite()}>
                + ОП
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="shrink-0 p-1 rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            onClick={() => scrollTabs(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div ref={tabsRef} className="flex-1 flex gap-1 overflow-x-auto pb-1">
            {[
              ['dashboard', 'Дашборд'],
              ['validation-summary', 'Итог проверок'],
              ...(fullAccess ? [['combined', 'Общий'] as const] : []),
              ...visibleSites.map((s) => [s.name, s.name] as const),
            ].map(([id, label]) => {
              const tabErrors =
                id === 'validation-summary' && totalValidationErrors > 0
                  ? totalValidationErrors
                  : 0
              return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border whitespace-nowrap shrink-0 ${
                  activeTab === id
                    ? 'bg-amber-100 border-amber-400 text-amber-900'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {label.length > 22 ? `${label.slice(0, 20)}…` : label}
                {tabErrors > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold">
                    {tabErrors > 99 ? '99+' : tabErrors}
                  </span>
                )}
              </button>
            )})}
          </div>
          <button
            type="button"
            className="shrink-0 p-1 rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            onClick={() => scrollTabs(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden p-4">
        {activeTab === 'dashboard' && (
          <div className="flex-1 min-h-0 flex flex-col min-w-0">
            <DailyAccountingDashboard date={date} />
          </div>
        )}

        {activeTab === 'validation-summary' && (
          <div className="flex-1 min-h-0 flex flex-col min-w-0">
            <DailyAccountingValidationSummary
              dateLabel={formatDateRu(date)}
              scopes={validationScopes}
              selectedScopeId={validationSummaryScope}
              onSelectScope={setValidationSummaryScope}
              validating={validating}
              onRunAll={() => void runAllValidations()}
              onRunScope={runValidateScope}
            />
          </div>
        )}

        {fullAccess && combinedReady && (
          <div
            className={`flex-1 min-h-0 flex flex-col min-w-0 ${activeTab !== 'combined' ? 'hidden' : ''}`}
            aria-hidden={activeTab !== 'combined'}
          >
            <SiteTable
              date={date}
              site=""
              combined
              showSiteColumn
              rows={getCachedRows('', true)}
              loading={siteTableLoading('', true)}
              onUpload={() => {}}
              uploadDisabled
              clearDisabled={!user || !fullAccess}
              validateDisabled={!user || !fullAccess}
              user={user}
              canExport
              onClear={() => handleClearSite('', true)}
              onValidate={() =>
                void runValidate({
                  combined: true,
                  title: `Проверка — Общий — ${formatDateRu(date)}`,
                })
              }
              validating={validating}
              actionBusy={actionBusy}
            />
          </div>
        )}

        {activeTab === 'combined' && fullAccess && !combinedReady && (
          <div className="flex-1 min-h-0 flex flex-col min-w-0">
            <div className="flex flex-col items-start gap-3 p-6 border border-dashed border-amber-300 rounded-lg bg-amber-50/50">
              <p className="text-sm text-gray-700 max-w-xl">
                «Общий» отчёт не создан. Будут объединены данные всех площадок за {formatDateRu(date)}:
                «Прием»/«Нелегал» → «Кандидат», статус по справочнику АУП_РОП_ИТР (Настройки).
              </p>
              <Button
                size="sm"
                className="h-9"
                disabled={buildingCombined || !user}
                onClick={() => void buildCombined()}
              >
                {buildingCombined ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : null}
                Создать Общий отчёт
              </Button>
            </div>
          </div>
        )}

        {visibleSites.map((s) => (
          <div
            key={s.name}
            className={`flex-1 min-h-0 flex flex-col min-w-0 ${activeTab !== s.name ? 'hidden' : ''}`}
            aria-hidden={activeTab !== s.name}
          >
            <SiteTable
              date={date}
              site={s.name}
              combined={false}
              showSiteColumn={false}
              rows={getCachedRows(s.name, false)}
              loading={siteTableLoading(s.name, false)}
              onUpload={(f) => void onUploadForSite(s.name, f)}
              uploadDisabled={uploadDisabledFor(s.name)}
              clearDisabled={!user || !canAccessSite(user, s.name)}
              validateDisabled={!canValidateSite(s.name)}
              user={user}
              canExport
              onClear={() => handleClearSite(s.name, false)}
              onValidate={() =>
                void runValidate({
                  locationId: s.name,
                  title: `Проверка — ${s.name}`,
                })
              }
              validating={validating}
              actionBusy={actionBusy}
            />
          </div>
        ))}
      </div>

      <DailyAccountingValidationDialog
        open={validationOpen}
        onClose={() => setValidationOpen(false)}
        title={validationTitle}
        errors={validationErrors}
        rowCount={validationRowCount}
      />

      {fullAccess && user && (
        <DailyAccountingBulkUpload
          open={bulkOpen}
          onClose={() => setBulkOpen(false)}
          sites={siteItems}
          defaultDate={date}
          user={user}
          onStartUpload={async (entries, bulkDate, ui) => {
            ui.setUploading(true)
            try {
              await runDailyAction(
                'Массовая загрузка',
                [
                  'Подготовка',
                  ...entries.map((e) => `${e.locationId}: ${e.file.name}`),
                  'Обновление кэша',
                  'Готово',
                ],
                async ({ advance, checkAborted }) => {
                  const updated = [...entries]
                  let okCount = 0
                  let errCount = 0
                  for (let i = 0; i < updated.length; i++) {
                    checkAborted()
                    const entry = updated[i]!
                    updated[i] = { ...entry, status: 'uploading' }
                    ui.setEntries([...updated])
                    advance(`${entry.locationId}: ${entry.file.name}`)
                    try {
                      const body = await api.dailyUpload({
                        file: entry.file,
                        locationId: entry.locationId,
                        date: bulkDate,
                        replaceSiteDate: true,
                        user,
                      })
                      const count = (body as { rowCount?: number }).rowCount ?? 0
                      okCount += 1
                      updated[i] = {
                        ...entry,
                        status: 'done',
                        message: `${count} чел.`,
                      }
                      invalidateCache(`${date}|${entry.locationId}`)
                      setActiveTab(entry.locationId)
                    } catch (e) {
                      errCount += 1
                      updated[i] = {
                        ...entry,
                        status: 'error',
                        message: e instanceof Error ? e.message : 'Ошибка',
                      }
                    }
                    ui.setEntries([...updated])
                  }
                  invalidateCache(`${date}|`)
                  setCombinedReady(false)
                  bumpRefresh()
                  if (errCount > 0) {
                    return `Загружено ${okCount} из ${entries.length}, ошибок: ${errCount}`
                  }
                  return `Массовая загрузка: ${okCount} файл(ов) успешно`
                },
              )
            } catch {
              /* остановка / ошибка в статус-баре */
            } finally {
              ui.setUploading(false)
            }
          }}
        />
      )}

      <div className="shrink-0 px-4 py-2 border-t border-gray-200 bg-white">
        <TicketCostsActionStatusBar
          status={actionStatus}
          onStop={() => stopAction()}
          onDismiss={() => resetActionStatus()}
        />
        {!actionStatus && (
          <p className="text-[10px] text-gray-400 mt-1">
            Статус операций: загрузка, проверка, «Общий», очистка, массовая загрузка.
          </p>
        )}
      </div>
    </div>
  )
}
