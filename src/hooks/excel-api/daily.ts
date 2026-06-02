import type { createHealthApi } from '@/hooks/excel-api/health'
import type { AppUser } from '@/lib/app-auth'

type HealthApi = ReturnType<typeof createHealthApi>

export type DailySiteItem = {
  name: string
  opStatus: 'active' | 'paused' | 'finished'
  statusLabel: string
  custom?: boolean
}

function authFields(user: AppUser | null) {
  if (!user) return {}
  return {
    user_role: user.role,
    user_sites: user.sites.join('|'),
  }
}

export function createDailyApi({ ensureExcelBackend }: HealthApi) {
  const dailySites = async (activeOnly = true, detailed = false) => {
    await ensureExcelBackend({ lenient: true })
    const sp = new URLSearchParams({
      action: 'sites',
      active_only: String(activeOnly),
    })
    if (detailed) sp.set('detailed', 'true')
    const res = await fetch(`/api/excel/daily-tracking?${sp}`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(String((data as { detail?: string }).detail || 'Ошибка списка площадок'))
    return data as { sites: string[]; items?: DailySiteItem[] }
  }

  const dailyList = async (params: {
    date: string
    locationId?: string
    combined?: boolean
    limit?: number
    offset?: number
  }) => {
    await ensureExcelBackend({ lenient: true })
    const sp = new URLSearchParams({ action: 'list', date: params.date })
    if (params.locationId) sp.set('location_id', params.locationId)
    if (params.combined) sp.set('combined', 'true')
    sp.set('limit', String(params.limit ?? 5000))
    sp.set('offset', String(params.offset ?? 0))
    const res = await fetch(`/api/excel/daily-tracking?${sp}`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(String((data as { detail?: string }).detail || 'Ошибка загрузки данных'))
    return data as {
      data: Record<string, unknown>[]
      total: number
      hasCombined?: boolean
    }
  }

  const dailyStats = async (params: { date: string; locationId?: string; combined?: boolean }) => {
    await ensureExcelBackend({ lenient: true })
    const sp = new URLSearchParams({ action: 'stats', date: params.date })
    if (params.locationId) sp.set('location_id', params.locationId)
    if (params.combined) sp.set('combined', 'true')
    const res = await fetch(`/api/excel/daily-tracking?${sp}`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(String((data as { detail?: string }).detail || 'Ошибка статистики'))
    return data
  }

  const dailyUpload = async (params: {
    file: File
    locationId: string
    date: string
    confirm?: boolean
    replaceSiteDate?: boolean
    user?: AppUser | null
  }) => {
    await ensureExcelBackend()
    const form = new FormData()
    form.append('file', params.file)
    form.append('location_id', params.locationId)
    form.append('date', params.date)
    form.append('confirm', String(Boolean(params.confirm)))
    form.append('replace_site_date', String(Boolean(params.replaceSiteDate)))
    const auth = authFields(params.user ?? null)
    if (auth.user_role) form.append('user_role', auth.user_role)
    if (auth.user_sites) form.append('user_sites', auth.user_sites)
    const res = await fetch('/api/excel/daily-tracking', { method: 'POST', body: form })
    const data = await res.json().catch(() => ({}))
    if (res.status === 409) {
      const err = new Error('Требуется подтверждение замены') as Error & {
        requiresConfirm?: boolean
        existingCount?: number
      }
      err.requiresConfirm = true
      const detail = (data as { detail?: { existingCount?: number } }).detail
      err.existingCount = detail?.existingCount
      throw err
    }
    if (!res.ok) {
      throw new Error(
        typeof (data as { detail?: unknown }).detail === 'string'
          ? (data as { detail: string }).detail
          : (data as { error?: string }).error || 'Ошибка загрузки Excel',
      )
    }
    return data as { rowCount?: number; locationId?: string }
  }

  const dailyAddSite = async (name: string, user: AppUser) => {
    await ensureExcelBackend()
    const sp = new URLSearchParams({ user_role: user.role })
    const res = await fetch(`/api/excel/daily-tracking/sites?${sp}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(String((data as { detail?: string }).detail || 'Не удалось добавить площадку'))
    return data as { sites?: DailySiteItem[] }
  }

  const dailyTemplateStatus = async () => {
    await ensureExcelBackend({ lenient: true })
    const res = await fetch('/api/excel/daily-tracking/template')
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(String((data as { detail?: string }).detail || 'Ошибка шаблона'))
    return data as {
      hasTemplate?: boolean
      originalName?: string
      uploadedAt?: string
      size?: number
    }
  }

  const dailyUploadTemplate = async (file: File) => {
    await ensureExcelBackend()
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/excel/daily-tracking/template', { method: 'POST', body: form })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(String((data as { detail?: string }).detail || 'Ошибка загрузки шаблона'))
    return data
  }

  const dailyClear = async (params: {
    date: string
    locationId?: string
    combined?: boolean
    user?: AppUser | null
  }) => {
    await ensureExcelBackend()
    const sp = new URLSearchParams({ date: params.date })
    if (params.combined) sp.set('combined', 'true')
    else if (params.locationId) sp.set('location_id', params.locationId)
    const auth = authFields(params.user ?? null)
    if (auth.user_role) sp.set('user_role', auth.user_role)
    if (auth.user_sites) sp.set('user_sites', auth.user_sites)
    const res = await fetch(`/api/excel/daily-tracking?${sp}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(
        typeof (data as { detail?: unknown }).detail === 'string'
          ? (data as { detail: string }).detail
          : (data as { error?: string }).error || 'Ошибка очистки данных',
      )
    }
    return data as {
      deletedRows?: number
      deletedUploads?: number
      deletedSites?: number
      combined?: boolean
    }
  }

  const dailyBuildCombined = async (date: string, user: AppUser) => {
    await ensureExcelBackend()
    const sp = new URLSearchParams({ date, user_role: user.role })
    const res = await fetch(`/api/excel/daily-tracking/combined?${sp}`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(String((data as { detail?: string }).detail || 'Ошибка формирования «Общий»'))
    return data as { rowCount?: number; hasCombined?: boolean }
  }

  const dailyValidate = async (params: {
    date: string
    locationId?: string
    combined?: boolean
  }) => {
    await ensureExcelBackend({ lenient: true })
    const sp = new URLSearchParams({ date: params.date })
    if (params.locationId) sp.set('location_id', params.locationId)
    if (params.combined) sp.set('combined', 'true')
    const res = await fetch(`/api/excel/daily-tracking/validate?${sp}`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(String((data as { detail?: string }).detail || 'Ошибка проверки'))
    return data as {
      errors: Array<{
        check: string
        row: number
        locationId?: string
        tabNumber?: string
        fio?: string
        field?: string
        message: string
        mainDb?: Record<string, unknown>
      }>
      errorCount: number
      hasErrors: boolean
      rowCount: number
    }
  }

  const dailyAupStatus = async () => {
    await ensureExcelBackend({ lenient: true })
    const res = await fetch('/api/excel/daily-tracking/aup')
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(String((data as { detail?: string }).detail || 'Ошибка АУП'))
    return data as {
      hasAup?: boolean
      originalName?: string
      uploadedAt?: string
      size?: number
      mappingCount?: number
    }
  }

  const dailyUploadAup = async (file: File) => {
    await ensureExcelBackend()
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/excel/daily-tracking/aup', { method: 'POST', body: form })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(String((data as { detail?: string }).detail || 'Ошибка загрузки АУП'))
    return data
  }

  const dailyExport = async (params: {
    date: string
    locationId?: string
    combined?: boolean
    fileName?: string
  }) => {
    await ensureExcelBackend()
    const sp = new URLSearchParams({ date: params.date })
    if (params.locationId) sp.set('location_id', params.locationId)
    if (params.combined) sp.set('combined', 'true')
    const res = await fetch(`/api/excel/daily-tracking/export?${sp}`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(String((data as { detail?: string }).detail || 'Ошибка выгрузки'))
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = params.fileName || `Ежедневный_учет_${params.date}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  return {
    dailySites,
    dailyList,
    dailyStats,
    dailyUpload,
    dailyAddSite,
    dailyTemplateStatus,
    dailyUploadTemplate,
    dailyExport,
    dailyClear,
    dailyBuildCombined,
    dailyValidate,
    dailyAupStatus,
    dailyUploadAup,
  }
}
