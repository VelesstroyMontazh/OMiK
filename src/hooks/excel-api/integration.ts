import { proxyJson } from '@/hooks/excel-api/http'
import type { createHealthApi } from '@/hooks/excel-api/health'

type HealthApi = ReturnType<typeof createHealthApi>

export function createIntegrationApi({ ensureExcelBackend }: HealthApi) {
  const loadCalendarByPath = async (filePath: string) =>
    proxyJson('/api/excel/integration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'calendar-load-by-path', file_path: filePath }),
    })

  const mergeTicketsWithMainDb = async (params: {
    ticket_file_path?: string
    output_name?: string
    sheet_name?: string
    passport_column?: string
    use_registry?: boolean
    registry?: 'vsm' | 'sk'
  }) => {
    await ensureExcelBackend()
    let response: Response
    try {
      response = await fetch('/api/excel/integration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'tickets-merge-with-main-db', ...params }),
      })
    } catch {
      throw new Error(
        'Связь с excel-service прервана. Запустите .\\.zscripts\\start-excel-service.cmd и повторите. Объединение реестра может занять 10–40 мин — не закрывайте вкладку.',
      )
    }
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      const err = data as { detail?: string; error?: string }
      throw new Error(
        err.detail || err.error || `Ошибка объединения отчета билетов с Базой (${response.status})`,
      )
    }
    return data
  }

  const prepareExcelFile = async (params: {
    file_path: string
    output_name?: string
    save_in_place?: boolean
  }) => {
    let response: Response
    try {
      response = await fetch('/api/excel/file-prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'process', ...params }),
      })
    } catch {
      throw new Error(
        'Не удалось связаться с сервером. Проверьте, что запущены Next.js (порт 3000) и excel-service (python app.py, порт 3031).',
      )
    }
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      const err = data as { detail?: string; error?: string }
      throw new Error(err.detail || err.error || `Ошибка подготовки файла Excel (${response.status})`)
    }
    return data
  }

  const mergeCalendarWithMainDb = async (output_name?: string) =>
    proxyJson('/api/excel/integration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'calendar-merge-with-main-db', output_name }),
    })

  return {
    loadCalendarByPath,
    mergeTicketsWithMainDb,
    prepareExcelFile,
    mergeCalendarWithMainDb,
  }
}
