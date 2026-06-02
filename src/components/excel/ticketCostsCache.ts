import type { TicketCostsDashboardData } from '@/components/excel/TicketCostsDashboardView'

export type RegistryId = 'vsm' | 'sk'

export interface TicketCostsColumnDef {
  key: string
  title: string
  format?: 'text' | 'money' | 'id'
}

export interface TicketCostsDataRow {
  _row_id: string
  [key: string]: unknown
}

export interface TicketCostsFilterState {
  year: string
  month: string
  /** Фильтр «Площадка» — столбец ploshchadka в processed */
  ploshchadka: string
  obosnovanie: string
  organizaciya: string
  klassifikaciya: string
  aviaperevozchik: string
}

export function filtersToApiParams(filters: TicketCostsFilterState) {
  return {
    ploshchadka: filters.ploshchadka || undefined,
    year: filters.year ? Number(filters.year) : undefined,
    month: filters.month ? Number(filters.month) : undefined,
    obosnovanie: filters.obosnovanie || undefined,
    organizaciya: filters.organizaciya || undefined,
    klassifikaciya: filters.klassifikaciya || undefined,
    aviaperevozchik: filters.aviaperevozchik || undefined,
  }
}

export function buildTableFetchKey(
  registry: RegistryId,
  refreshKey: number,
  filters: TicketCostsFilterState,
) {
  return [
    registry,
    refreshKey,
    filters.year,
    filters.month,
    filters.ploshchadka,
    filters.obosnovanie,
    filters.organizaciya,
    filters.klassifikaciya,
    filters.aviaperevozchik,
  ].join('|')
}

export function buildDashboardFetchKey(filters: TicketCostsFilterState) {
  return [
    filters.year,
    filters.month,
    filters.ploshchadka,
    filters.obosnovanie,
    filters.organizaciya,
    filters.klassifikaciya,
    filters.aviaperevozchik,
  ].join('|')
}

type TableCacheEntry = {
  columns: TicketCostsColumnDef[]
  rows: TicketCostsDataRow[]
  total: number
  fetchKey: string
}

type DashboardCacheEntry = {
  data: TicketCostsDashboardData
  fetchKey: string
}

const tableCache: Partial<Record<RegistryId, TableCacheEntry>> = {}
const dashboardCache: { entry: DashboardCacheEntry | null } = { entry: null }

const inflightTable = new Map<string, Promise<TableCacheEntry | null>>()
let inflightDashboard: Promise<DashboardCacheEntry | null> | null = null

const tableFetchAbort = new Map<RegistryId, AbortController>()

/** Перед очисткой реестра: отменить загрузку таблицы и сбросить кэш. */
export function prepareRegistryClear(registry: RegistryId) {
  tableFetchAbort.get(registry)?.abort()
  const ac = new AbortController()
  tableFetchAbort.set(registry, ac)
  invalidateTicketCostsCache(registry)
  inflightTable.clear()
  inflightDashboard = null
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('omik-tickets-prepare-clear', { detail: { registry } }))
  }
  return ac.signal
}

export function getTableFetchAbortSignal(registry: RegistryId): AbortSignal | undefined {
  return tableFetchAbort.get(registry)?.signal
}

export function getTableCache(registry: RegistryId, fetchKey: string) {
  const hit = tableCache[registry]
  return hit?.fetchKey === fetchKey ? hit : null
}

export function getDashboardCache(fetchKey: string) {
  return dashboardCache.entry?.fetchKey === fetchKey ? dashboardCache.entry.data : null
}

export function setTableCache(
  registry: RegistryId,
  fetchKey: string,
  entry: Omit<TableCacheEntry, 'fetchKey'>,
) {
  tableCache[registry] = { ...entry, fetchKey }
}

export function invalidateTicketCostsCache(registry?: RegistryId) {
  if (registry) {
    delete tableCache[registry]
  } else {
    delete tableCache.vsm
    delete tableCache.sk
    dashboardCache.entry = null
  }
}

export async function ensureTableCache(
  registry: RegistryId,
  fetchKey: string,
  fetcher: () => Promise<{
    columns?: TicketCostsColumnDef[]
    data?: TicketCostsDataRow[]
    total?: number
  }>,
): Promise<TableCacheEntry | null> {
  const cached = getTableCache(registry, fetchKey)
  if (cached) return cached

  const existing = inflightTable.get(fetchKey)
  if (existing) return existing

  const task = (async () => {
    try {
      const res = await fetcher()
      const entry: TableCacheEntry = {
        columns: res.columns || [],
        rows: res.data || [],
        total: res.total ?? (res.data?.length ?? 0),
        fetchKey,
      }
      tableCache[registry] = entry
      return entry
    } catch {
      return null
    } finally {
      inflightTable.delete(fetchKey)
    }
  })()

  inflightTable.set(fetchKey, task)
  return task
}

export async function ensureDashboardCache(
  fetchKey: string,
  fetcher: () => Promise<TicketCostsDashboardData>,
): Promise<DashboardCacheEntry | null> {
  const cached = getDashboardCache(fetchKey)
  if (cached) {
    return { data: cached, fetchKey }
  }

  if (inflightDashboard) return inflightDashboard

  inflightDashboard = (async () => {
    try {
      const data = await fetcher()
      const entry = { data, fetchKey }
      dashboardCache.entry = entry
      return entry
    } catch {
      return null
    } finally {
      inflightDashboard = null
    }
  })()

  return inflightDashboard
}
