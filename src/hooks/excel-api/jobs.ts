import { proxyJson } from '@/hooks/excel-api/http'
import { excelBackendJson, getExcelBackendUrl, type JobRecord } from '@/lib/excel-backend-direct'

export function createJobsApi() {
  const getJob = async (jobId: string): Promise<JobRecord> => {
    const base = getExcelBackendUrl()
    if (base) {
      try {
        return await excelBackendJson<JobRecord>(
          `/api/jobs/${encodeURIComponent(jobId)}`,
          { method: 'GET' },
          30_000,
        )
      } catch {
        /* fallback to Next proxy */
      }
    }
    return proxyJson<JobRecord>(`/api/excel/jobs/${encodeURIComponent(jobId)}`, {
      method: 'GET',
    })
  }

  return { getJob }
}
