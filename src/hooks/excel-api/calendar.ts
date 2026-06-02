import { proxyJson } from '@/hooks/excel-api/http'

export function createCalendarApi() {
  const calendarStatus = async () => {
    const response = await fetch('/api/excel/calendar?action=status', { method: 'GET' })
    const data = await response.json().catch(() => ({ loaded: false }))
    if (!response.ok) {
      if (response.status === 504) return { loaded: false }
      throw new Error((data as { detail?: string }).detail || 'Ошибка получения статуса календаря')
    }
    return data
  }

  const calendarLoad = async () =>
    proxyJson('/api/excel/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'load' }),
    })

  const calendarData = async (params?: {
    direction?: string
    year?: number
    month?: number
    citizenship?: string
    justification?: string
    justification_contains?: string
    arrival_status?: string
    worker_type?: string
    department?: string
    date_from?: string
    date_to?: string
    search?: string
    offset?: number
    limit?: number
  }) => {
    const sp = new URLSearchParams({ action: 'data' })
    if (params?.direction) sp.set('direction', params.direction)
    if (params?.year) sp.set('year', String(params.year))
    if (params?.month) sp.set('month', String(params.month))
    if (params?.citizenship) sp.set('citizenship', params.citizenship)
    if (params?.justification) sp.set('justification', params.justification)
    if (params?.justification_contains) sp.set('justification_contains', params.justification_contains)
    if (params?.arrival_status) sp.set('arrival_status', params.arrival_status)
    if (params?.worker_type) sp.set('worker_type', params.worker_type)
    if (params?.department) sp.set('department', params.department)
    if (params?.date_from) sp.set('date_from', params.date_from)
    if (params?.date_to) sp.set('date_to', params.date_to)
    if (params?.search) sp.set('search', params.search)
    sp.set('offset', String(params?.offset ?? 0))
    sp.set('limit', String(params?.limit ?? 200))
    return proxyJson(`/api/excel/calendar?${sp.toString()}`, { method: 'GET' })
  }

  const calendarStats = async (params?: { direction?: string; year?: number; month?: number }) => {
    const sp = new URLSearchParams({ action: 'stats' })
    if (params?.direction) sp.set('direction', params.direction)
    if (params?.year) sp.set('year', String(params.year))
    if (params?.month) sp.set('month', String(params.month))
    return proxyJson(`/api/excel/calendar?${sp.toString()}`, { method: 'GET' })
  }

  const calendarMergedStatus = async () => {
    const response = await fetch('/api/excel/calendar?action=merged-status', { method: 'GET' })
    const data = await response.json().catch(() => ({ loaded: false }))
    if (!response.ok) {
      if (response.status === 504) return { loaded: false }
      throw new Error((data as { detail?: string }).detail || 'Ошибка статуса объединенного календаря')
    }
    return data
  }

  const calendarMergedData = async (params?: {
    direction?: string
    year?: number
    month?: number
    search?: string
    offset?: number
    limit?: number
  }) => {
    const sp = new URLSearchParams({ action: 'merged-data' })
    if (params?.direction) sp.set('direction', params.direction)
    if (params?.year) sp.set('year', String(params.year))
    if (params?.month) sp.set('month', String(params.month))
    if (params?.search) sp.set('search', params.search)
    sp.set('offset', String(params?.offset ?? 0))
    sp.set('limit', String(params?.limit ?? 200))
    return proxyJson(`/api/excel/calendar?${sp.toString()}`, { method: 'GET' })
  }

  return {
    calendarStatus,
    calendarLoad,
    calendarData,
    calendarStats,
    calendarMergedStatus,
    calendarMergedData,
  }
}
