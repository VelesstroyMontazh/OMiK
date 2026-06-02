import { proxyJson } from '@/hooks/excel-api/http'
import type { createHealthApi } from '@/hooks/excel-api/health'

type HealthApi = ReturnType<typeof createHealthApi>

export function createReportsApi({ ensureExcelBackend }: HealthApi) {
  const generateReport = async (params: {
    report_type: string
    year?: number | null
    month?: number | null
    citizenship?: string | null
    territory?: string | null
    organization?: string | null
    status?: string | null
    direction?: string | null
    justification?: string | null
    justification_contains?: string | null
    arrival_status?: string | null
    worker_type?: string | null
    department?: string | null
    start_date?: string | null
    end_date?: string | null
    output_name?: string | null
    gelendzhik_file_path?: string | null
    site_territory?: string | null
  }) => {
    await ensureExcelBackend()
    return proxyJson('/api/excel/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate', ...params }),
    })
  }

  const generateGelendzhikCareerReport = async (params: {
    gelendzhik_file_path?: string
    site_territory?: string
    output_name?: string
  }) =>
    generateReport({
      report_type: 'gelendzhik_career_path',
      gelendzhik_file_path: params.gelendzhik_file_path ?? null,
      site_territory: params.site_territory ?? null,
      output_name: params.output_name ?? null,
    })

  const getReportFilters = async () => {
    const response = await fetch('/api/excel/reports?action=filters', { method: 'GET' })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      if (response.status === 504) return { calendar: {} }
      throw new Error((data as { detail?: string }).detail || 'Ошибка получения фильтров')
    }
    return data
  }

  const generateBasePresenceReport = async (start_date?: string, end_date?: string) =>
    generateReport({
      report_type: 'base_presence_matrix',
      start_date,
      end_date,
    })

  return {
    generateReport,
    generateGelendzhikCareerReport,
    getReportFilters,
    generateBasePresenceReport,
  }
}
