import { proxyJson } from '@/hooks/excel-api/http'
import type { createHealthApi } from '@/hooks/excel-api/health'
import type { createJobsApi } from '@/hooks/excel-api/jobs'
import {
  excelBackendJson,
  getExcelBackendUrl,
  pollExcelJob,
  type JobRecord,
} from '@/lib/excel-backend-direct'

type HealthApi = ReturnType<typeof createHealthApi>
type JobsApi = ReturnType<typeof createJobsApi>

export function createTicketsApi({ ensureExcelBackend }: HealthApi, jobs: JobsApi) {
  const pollJob = (
    jobId: string,
    onTick?: (job: JobRecord) => void,
    timeoutMs = 1_800_000,
  ) => pollExcelJob(jobId, jobs.getJob, { onTick, timeoutMs })
  const ticketsRegistryStatus = async (registry?: string) => {
    const sp = new URLSearchParams({ action: 'status' })
    if (registry) sp.set('registry', registry)
    const response = await fetch(`/api/excel/tickets-registry?${sp.toString()}`, { method: 'GET' })
    const data = await response.json().catch(() => ({ loaded: false, registries: {} }))
    if (!response.ok) {
      if (response.status === 504) {
        return registry
          ? { loaded: false, registry, label: registry === 'sk' ? 'СК' : 'ВСМ' }
          : { loaded: false, registries: { vsm: { loaded: false }, sk: { loaded: false } } }
      }
      throw new Error((data as { detail?: string }).detail || 'Ошибка получения статуса реестра билетов')
    }
    return data
  }

  const ticketsRegistryLoad = async (params: {
    file_path: string
    registry: 'vsm' | 'sk'
    sheet_name?: string
  }) => {
    const response = await fetch('/api/excel/tickets-registry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'load', ...params }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error((err as { detail?: string }).detail || 'Ошибка загрузки реестра билетов')
    }
    return response.json()
  }

  const ticketsRegistryData = async (params?: {
    registry?: 'vsm' | 'sk'
    search?: string
    offset?: number
    limit?: number
  }) => {
    const sp = new URLSearchParams({ action: 'data' })
    sp.set('registry', params?.registry || 'vsm')
    if (params?.search) sp.set('search', params.search)
    sp.set('offset', String(params?.offset ?? 0))
    sp.set('limit', String(params?.limit ?? 200))
    return proxyJson(`/api/excel/tickets-registry?${sp.toString()}`, { method: 'GET' })
  }

  const ticketsRegistryClear = async (registry?: 'vsm' | 'sk') => {
    const qs = registry ? `?registry=${registry}` : ''
    return proxyJson(`/api/excel/tickets-registry${qs}`, { method: 'DELETE' })
  }

  const ticketsCostsStatus = async (registry?: string, options?: { light?: boolean }) => {
    const qsParams = new URLSearchParams()
    if (registry) qsParams.set('registry', registry)
    if (options?.light === true) qsParams.set('light', 'true')
    const qs = qsParams.toString() ? `?${qsParams.toString()}` : ''
    const timeoutMs = 45_000
    const base = getExcelBackendUrl()

    if (base) {
      return excelBackendJson<Record<string, unknown>>(
        `/api/tickets-costs/status${qs}`,
        { method: 'GET' },
        timeoutMs,
      )
    }

    const sp = new URLSearchParams({ action: 'status' })
    if (registry) sp.set('registry', registry)
    if (options?.light === true) sp.set('light', 'true')
    const response = await fetch(`/api/excel/tickets-costs?${sp.toString()}`, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
    })
    const data = await response.json().catch(() => ({ registries: {} }))
    if (!response.ok) {
      throw new Error((data as { detail?: string }).detail || 'Ошибка статуса затрат по билетам')
    }
    return data
  }

  const ticketsCostsDashboard = async (params?: {
    registry?: 'vsm' | 'sk'
    year?: number
    month?: number
    podrazdelenie?: string
    ploshchadka?: string
    obosnovanie?: string
    organizaciya?: string
    klassifikaciya?: string
    aviaperevozchik?: string
  }) => {
    const qsParams = new URLSearchParams()
    if (params?.registry) qsParams.set('registry', params.registry)
    if (params?.year != null) qsParams.set('year', String(params.year))
    if (params?.month != null) qsParams.set('month', String(params.month))
    if (params?.ploshchadka) qsParams.set('ploshchadka', params.ploshchadka)
    else if (params?.podrazdelenie) qsParams.set('ploshchadka', params.podrazdelenie)
    if (params?.obosnovanie) qsParams.set('obosnovanie', params.obosnovanie)
    if (params?.organizaciya) qsParams.set('organizaciya', params.organizaciya)
    if (params?.klassifikaciya) qsParams.set('klassifikaciya', params.klassifikaciya)
    if (params?.aviaperevozchik) qsParams.set('aviaperevozchik', params.aviaperevozchik)
    const qs = qsParams.toString() ? `?${qsParams.toString()}` : ''
    const timeoutMs = 600_000
    const base = getExcelBackendUrl()

    if (base) {
      return excelBackendJson<Record<string, unknown>>(
        `/api/tickets-costs/dashboard${qs}`,
        { method: 'GET' },
        timeoutMs,
      )
    }

    const sp = new URLSearchParams({ action: 'dashboard' })
    for (const [key, value] of qsParams.entries()) {
      sp.set(key, value)
    }
    const response = await fetch(`/api/excel/tickets-costs?${sp.toString()}`, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error((data as { detail?: string }).detail || 'Ошибка загрузки дашборда')
    }
    return data
  }

  const ticketsCostsQueueAdd = async (
    registry: 'vsm' | 'sk',
    items: Array<{ id: string; name: string; path: string; fileId?: string }>,
  ) => {
    if (!items.length) return { upload_queue: [] }
    const response = await fetch('/api/excel/tickets-costs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'queue-add',
        registry,
        items: items.map((i) => ({
          id: i.id,
          name: i.name,
          path: i.path,
          file_id: i.fileId,
        })),
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error((data as { detail?: string }).detail || 'Ошибка сохранения очереди')
    }
    return data
  }

  const ticketsCostsQueueRemove = async (registry: 'vsm' | 'sk', queueId: string) => {
    const sp = new URLSearchParams({ action: 'queue-remove', registry, queue_id: queueId })
    const response = await fetch(`/api/excel/tickets-costs?${sp.toString()}`, { method: 'DELETE' })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error((data as { detail?: string }).detail || 'Ошибка удаления из очереди')
    }
    return data
  }

  const ticketsCostsLoad = async (params: {
    file_paths: string[]
    registry: 'vsm' | 'sk'
    sheet_name?: string
    append?: boolean
  }) => {
    const body = {
      file_paths: params.file_paths,
      registry: params.registry,
      sheet_name: params.sheet_name,
      append: Boolean(params.append),
    }
    const useBackground = params.file_paths.length >= 2
    const base = getExcelBackendUrl()

    if (useBackground) {
      if (base) {
        const queued = await excelBackendJson<{ job_id: string }>(
          '/api/tickets-costs/load?background=true',
          { method: 'POST', body: JSON.stringify(body) },
          60_000,
        )
        return (await pollJob(queued.job_id)) as Record<string, unknown>
      }
      const response = await fetch('/api/excel/tickets-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'load', background: true, ...params }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error((data as { detail?: string }).detail || 'Ошибка загрузки файлов')
      }
      const jobId = (data as { job_id?: string }).job_id
      if (!jobId) return data
      return (await pollJob(jobId)) as Record<string, unknown>
    }

    if (base) {
      return excelBackendJson<Record<string, unknown>>('/api/tickets-costs/load', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    }

    await ensureExcelBackend({ lenient: true })
    const response = await fetch('/api/excel/tickets-costs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'load', ...params }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error((data as { detail?: string }).detail || 'Ошибка загрузки файлов')
    }
    return data
  }

  const ticketsCostsProcess = async (
    registry: 'vsm' | 'sk',
    options?: { fuzzyFioCutoff?: number; background?: boolean },
  ) => {
    const fuzzy = options?.fuzzyFioCutoff ?? 86
    const useBackground = options?.background !== false
    const body = { registry, fuzzy_fio_cutoff: fuzzy }
    const base = getExcelBackendUrl()

    if (useBackground) {
      if (base) {
        const queued = await excelBackendJson<{ job_id: string }>(
          '/api/tickets-costs/process?background=true',
          { method: 'POST', body: JSON.stringify(body) },
          60_000,
        )
        return (await pollJob(queued.job_id)) as Record<string, unknown>
      }
      const response = await fetch('/api/excel/tickets-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'process', background: true, registry, fuzzy_fio_cutoff: fuzzy }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error((data as { detail?: string }).detail || 'Ошибка обработки')
      }
      const jobId = (data as { job_id?: string }).job_id
      if (!jobId) return data
      return (await pollJob(jobId)) as Record<string, unknown>
    }

    if (base) {
      return excelBackendJson<Record<string, unknown>>('/api/tickets-costs/process', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    }

    await ensureExcelBackend({ lenient: true })
    const response = await fetch('/api/excel/tickets-costs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'process', registry, fuzzy_fio_cutoff: fuzzy }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error((data as { detail?: string }).detail || 'Ошибка обработки')
    }
    return data
  }

  /** Загрузка в реестр + обработка одной фоновой задачей (для «Обработать и отобразить»). */
  const ticketsCostsPipeline = async (
    params: {
      registry: 'vsm' | 'sk'
      file_paths: string[]
      append?: boolean
      sheet_name?: string
      fuzzyFioCutoff?: number
    },
    onTick?: (job: JobRecord) => void,
  ) => {
    const body = {
      registry: params.registry,
      file_paths: params.file_paths,
      append: Boolean(params.append),
      sheet_name: params.sheet_name,
      fuzzy_fio_cutoff: params.fuzzyFioCutoff ?? 86,
    }
    const base = getExcelBackendUrl()

    if (base) {
      const queued = await excelBackendJson<{ job_id: string }>(
        '/api/tickets-costs/pipeline?background=true',
        { method: 'POST', body: JSON.stringify(body) },
        60_000,
      )
      const raw = (await pollJob(queued.job_id, onTick, 5_400_000)) as Record<string, unknown>
      const proc = (raw.process as Record<string, unknown> | undefined) || raw
      return { ...proc, load: raw.load as Record<string, unknown> | undefined }
    }

    const response = await fetch('/api/excel/tickets-costs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'pipeline', ...body }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error((data as { detail?: string }).detail || 'Ошибка обработки')
    }
    const jobId = (data as { job_id?: string }).job_id
    if (!jobId) return data
    const raw = (await pollJob(jobId, onTick, 5_400_000)) as Record<string, unknown>
    const proc = (raw.process as Record<string, unknown> | undefined) || raw
    return { ...proc, load: raw.load as Record<string, unknown> | undefined }
  }

  const ticketsCostsDedupeEnrich = async (
    registry: 'vsm' | 'sk',
    options?: { fuzzy?: boolean; fuzzyFioCutoff?: number; runDedupe?: boolean },
  ) => {
    await ensureExcelBackend()
    const fuzzy = options?.fuzzy ?? false
    const response = await fetch('/api/excel/tickets-costs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'dedupe-enrich',
        registry,
        fuzzy,
        fuzzy_fio_cutoff: options?.fuzzyFioCutoff ?? 86,
        run_dedupe: options?.runDedupe !== false,
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error((data as { detail?: string }).detail || 'Ошибка дедупликации')
    }
    return data
  }

  const ticketsCostsData = async (params?: {
    registry?: 'vsm' | 'sk'
    search?: string
    podrazdelenie?: string
    ploshchadka?: string
    year?: number
    month?: number
    obosnovanie?: string
    organizaciya?: string
    klassifikaciya?: string
    aviaperevozchik?: string
    offset?: number
    limit?: number
    signal?: AbortSignal
  }) => {
    const sp = new URLSearchParams({ action: 'data' })
    sp.set('registry', params?.registry || 'vsm')
    if (params?.search) sp.set('search', params.search)
    if (params?.ploshchadka) sp.set('ploshchadka', params.ploshchadka)
    else if (params?.podrazdelenie) sp.set('ploshchadka', params.podrazdelenie)
    if (params?.year != null) sp.set('year', String(params.year))
    if (params?.month != null) sp.set('month', String(params.month))
    if (params?.obosnovanie) sp.set('obosnovanie', params.obosnovanie)
    if (params?.organizaciya) sp.set('organizaciya', params.organizaciya)
    if (params?.klassifikaciya) sp.set('klassifikaciya', params.klassifikaciya)
    if (params?.aviaperevozchik) sp.set('aviaperevozchik', params.aviaperevozchik)
    sp.set('offset', String(params?.offset ?? 0))
    sp.set('limit', String(params?.limit ?? 200))
    return proxyJson(`/api/excel/tickets-costs?${sp.toString()}`, {
      method: 'GET',
      signal: params?.signal,
    })
  }

  const ticketsCostsExportExcel = async (params: {
    registry: 'vsm' | 'sk'
    search?: string
    podrazdelenie?: string
    ploshchadka?: string
    year?: number
    month?: number
    obosnovanie?: string
    organizaciya?: string
    klassifikaciya?: string
    aviaperevozchik?: string
  }) => {
    await ensureExcelBackend()
    const sp = new URLSearchParams({ action: 'export' })
    sp.set('registry', params.registry)
    if (params.search) sp.set('search', params.search)
    if (params.ploshchadka) sp.set('ploshchadka', params.ploshchadka)
    else if (params.podrazdelenie) sp.set('ploshchadka', params.podrazdelenie)
    if (params.year != null) sp.set('year', String(params.year))
    if (params.month != null) sp.set('month', String(params.month))
    if (params.obosnovanie) sp.set('obosnovanie', params.obosnovanie)
    if (params.organizaciya) sp.set('organizaciya', params.organizaciya)
    if (params.klassifikaciya) sp.set('klassifikaciya', params.klassifikaciya)
    if (params.aviaperevozchik) sp.set('aviaperevozchik', params.aviaperevozchik)
    const response = await fetch(`/api/excel/tickets-costs?${sp.toString()}`)
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(
        (data as { detail?: string; error?: string }).detail
        || (data as { error?: string }).error
        || 'Ошибка экспорта в Excel',
      )
    }
    return data as { file_id?: string; row_count?: number; error?: string }
  }

  const ticketsCostsSaveRows = async (registry: 'vsm' | 'sk', rows: Record<string, unknown>[]) => {
    await ensureExcelBackend()
    const response = await fetch('/api/excel/tickets-costs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save-rows', registry, rows }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error((data as { detail?: string }).detail || 'Ошибка сохранения')
    }
    return data
  }

  const ticketsCostsClear = async (registry: 'vsm' | 'sk') => {
    const response = await fetch(`/api/excel/tickets-costs?registry=${registry}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(180_000),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(
        (data as { detail?: string; error?: string }).detail
          || (data as { error?: string }).error
          || 'Ошибка очистки',
      )
    }
    return data
  }

  const ticketsCostsSourcePreview = async (registry: 'vsm' | 'sk', fileId: string) => {
    const sp = new URLSearchParams({ action: 'source-preview', registry, file_id: fileId })
    const response = await fetch(`/api/excel/tickets-costs?${sp.toString()}`, { method: 'GET' })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error((data as { detail?: string }).detail || 'Ошибка предпросмотра файла')
    }
    return data
  }

  const ticketsCostsRuns = async (registry: 'vsm' | 'sk') => {
    const sp = new URLSearchParams({ action: 'runs', registry })
    return proxyJson(`/api/excel/tickets-costs?${sp.toString()}`, { method: 'GET' })
  }

  const ticketsCostsRunData = async (
    registry: 'vsm' | 'sk',
    runId: string,
    params?: { offset?: number; limit?: number },
  ) => {
    const sp = new URLSearchParams({ action: 'run-data', registry, run_id: runId })
    if (params?.offset != null) sp.set('offset', String(params.offset))
    sp.set('limit', String(params?.limit ?? 0))
    const response = await fetch(`/api/excel/tickets-costs?${sp.toString()}`, { method: 'GET' })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error((data as { detail?: string }).detail || 'Ошибка данных снимка')
    }
    return data
  }

  const ticketsCostsActivateRun = async (registry: 'vsm' | 'sk', runId: string) => {
    await ensureExcelBackend()
    const response = await fetch('/api/excel/tickets-costs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'activate-run', registry, run_id: runId }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error((data as { detail?: string }).detail || 'Ошибка активации снимка')
    }
    return data
  }

  const ticketsCostsDeleteRun = async (registry: 'vsm' | 'sk', runId: string) => {
    await ensureExcelBackend()
    const sp = new URLSearchParams({ action: 'delete-run', registry, run_id: runId })
    const response = await fetch(`/api/excel/tickets-costs?${sp.toString()}`, { method: 'DELETE' })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(
        (data as { detail?: string; error?: string }).detail
          || (data as { error?: string }).error
          || 'Ошибка удаления снимка',
      )
    }
    return data
  }

  const ticketsCostsFilterOptions = async (registry: 'vsm' | 'sk') => {
    await ensureExcelBackend()
    const timeoutMs = 120_000
    const base = getExcelBackendUrl()
    if (base) {
      return excelBackendJson<Record<string, unknown>>(
        `/api/tickets-costs/filter-options?registry=${encodeURIComponent(registry)}`,
        { method: 'GET' },
        timeoutMs,
      )
    }
    const sp = new URLSearchParams({ action: 'filter-options', registry })
    const response = await fetch(`/api/excel/tickets-costs?${sp.toString()}`, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error((data as { detail?: string }).detail || 'Ошибка загрузки фильтров')
    }
    return data
  }

  const ticketsCostsTableAction = async (
    registry: 'vsm' | 'sk',
    action:
      | 'clean_tab_passport'
      | 'enrich_passport'
      | 'enrich_fio_en'
      | 'enrich_fio_fuzzy'
      | 'fill_ploshchadka',
    options?: { fuzzyFioCutoff?: number },
  ) => {
    await ensureExcelBackend()
    const response = await fetch('/api/excel/tickets-costs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'table-action',
        registry,
        table_action: action,
        fuzzy_fio_cutoff: options?.fuzzyFioCutoff ?? 90,
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error((data as { detail?: string }).detail || 'Ошибка операции над таблицей')
    }
    return data
  }

  const ticketsCostsClearAllSources = async (registry: 'vsm' | 'sk') => {
    await ensureExcelBackend()
    const sp = new URLSearchParams({ action: 'clear-sources', registry })
    const response = await fetch(`/api/excel/tickets-costs?${sp.toString()}`, { method: 'DELETE' })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(
        (data as { detail?: string; error?: string }).detail
        || (data as { error?: string }).error
        || 'Ошибка очистки исходных файлов',
      )
    }
    return data
  }

  const ticketsCostsDeleteSourceFile = async (registry: 'vsm' | 'sk', fileId: string) => {
    await ensureExcelBackend()
    const sp = new URLSearchParams({ action: 'delete-source', registry, file_id: fileId })
    const response = await fetch(`/api/excel/tickets-costs?${sp.toString()}`, { method: 'DELETE' })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(
        (data as { detail?: string; error?: string }).detail
          || (data as { error?: string }).error
          || 'Ошибка удаления файла',
      )
    }
    return data
  }

  return {
    ticketsRegistryStatus,
    ticketsRegistryLoad,
    ticketsRegistryData,
    ticketsRegistryClear,
    ticketsCostsStatus,
    ticketsCostsDashboard,
    ticketsCostsQueueAdd,
    ticketsCostsQueueRemove,
    ticketsCostsLoad,
    ticketsCostsPipeline,
    ticketsCostsProcess,
    ticketsCostsDedupeEnrich,
    ticketsCostsFilterOptions,
    ticketsCostsTableAction,
    ticketsCostsClearAllSources,
    ticketsCostsData,
    ticketsCostsExportExcel,
    ticketsCostsSaveRows,
    ticketsCostsClear,
    ticketsCostsSourcePreview,
    ticketsCostsRuns,
    ticketsCostsRunData,
    ticketsCostsActivateRun,
    ticketsCostsDeleteRun,
    ticketsCostsDeleteSourceFile,
  }
}
