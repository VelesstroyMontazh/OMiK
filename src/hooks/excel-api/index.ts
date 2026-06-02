import { createCalendarApi } from '@/hooks/excel-api/calendar'
import { createDataOpsApi } from '@/hooks/excel-api/data-ops'
import { createFilesApi } from '@/hooks/excel-api/files'
import { createHealthApi } from '@/hooks/excel-api/health'
import { createIntegrationApi } from '@/hooks/excel-api/integration'
import { createJobsApi } from '@/hooks/excel-api/jobs'
import { createMacroApi } from '@/hooks/excel-api/macro'
import { createMainDbApi } from '@/hooks/excel-api/main-db'
import { createMergeApi } from '@/hooks/excel-api/merge'
import { createReportsApi } from '@/hooks/excel-api/reports'
import { createSheetsApi } from '@/hooks/excel-api/sheets'
import { createTicketsApi } from '@/hooks/excel-api/tickets'
import { createReferencesApi } from '@/hooks/excel-api/references'
import { createDailyApi } from '@/hooks/excel-api/daily'

export type ExcelApi = ReturnType<typeof createExcelApi>

export function createExcelApi() {
  const health = createHealthApi()
  const jobs = createJobsApi()
  return {
    ...createFilesApi(),
    ...createSheetsApi(),
    ...createDataOpsApi(),
    ...createMacroApi(),
    ...health,
    ...createMainDbApi(),
    ...createReportsApi(health),
    ...createCalendarApi(),
    ...createMergeApi(),
    ...createTicketsApi(health, jobs),
    ...createIntegrationApi(health),
    ...createReferencesApi(health),
    ...createDailyApi(health),
    ...jobs,
  }
}
