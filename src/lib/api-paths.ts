/**
 * Синхронизированные пути API: FastAPI excel-service (:3031) и Next.js proxy (/api/excel/*).
 * При добавлении endpoint — обновляйте здесь и в mini-services/excel-service/routers/.
 */

/** Прямые пути FastAPI (EXCEL_BACKEND_URL) */
export const BACKEND_PATHS = {
  HEALTH: '/api/health',
  UPLOAD: '/api/upload',
  FILES: '/api/files',
  JOBS: (jobId: string) => `/api/jobs/${encodeURIComponent(jobId)}`,

  TICKETS_REGISTRY_STATUS: '/api/tickets-registry/status',
  TICKETS_REGISTRY_LOAD: '/api/tickets-registry/load',
  TICKETS_REGISTRY_DATA: '/api/tickets-registry/data',
  TICKETS_REGISTRY_CLEAR: '/api/tickets-registry/clear',

  TICKETS_COSTS_STATUS: '/api/tickets-costs/status',
  TICKETS_COSTS_DASHBOARD: '/api/tickets-costs/dashboard',
  TICKETS_COSTS_DATA: '/api/tickets-costs/data',
  TICKETS_COSTS_LOAD: '/api/tickets-costs/load',
  TICKETS_COSTS_PROCESS: '/api/tickets-costs/process',
  TICKETS_COSTS_SAVE_ROWS: '/api/tickets-costs/save-rows',
  TICKETS_COSTS_CLEAR: '/api/tickets-costs/clear',
  TICKETS_COSTS_PIPELINE: '/api/tickets-costs/pipeline',
  TICKETS_COSTS_RUNS: '/api/tickets-costs/runs',
  TICKETS_COSTS_RUN_DATA: '/api/tickets-costs/run-data',
  TICKETS_COSTS_DEDUPE_ENRICH: '/api/tickets-costs/dedupe-enrich',

  CALENDAR_STATUS: '/api/calendar/status',
  CALENDAR_LOAD: '/api/calendar/load',
  CALENDAR_DATA: '/api/calendar/data',
  CALENDAR_CLEAR: '/api/calendar/clear',

  MAIN_DB_STATUS: '/api/main-db/status',
  MAIN_DB_DATA: '/api/main-db/data',
  MAIN_DB_LOAD: '/api/main-db/load',

  MERGE_SCAN: '/api/merge/scan-folder',
  MERGE_EXECUTE: '/api/merge/execute',

  REPORTS_GENERATE: '/api/reports/generate',
  REPORTS_FILTERS: '/api/reports/filters',
} as const

/** Префикс Next.js proxy */
export const EXCEL_PROXY_PREFIX = '/api/excel' as const

/** Маршруты Next.js (браузер → proxy → FastAPI) */
export const EXCEL_ROUTES = {
  HEALTH: `${EXCEL_PROXY_PREFIX}/health`,
  UPLOAD: `${EXCEL_PROXY_PREFIX}/upload`,
  FILES: `${EXCEL_PROXY_PREFIX}/files`,
  TICKETS_REGISTRY: `${EXCEL_PROXY_PREFIX}/tickets-registry`,
  TICKETS_COSTS: `${EXCEL_PROXY_PREFIX}/tickets-costs`,
  CALENDAR: `${EXCEL_PROXY_PREFIX}/calendar`,
  MAIN_DB: `${EXCEL_PROXY_PREFIX}/main-db`,
  MERGE: `${EXCEL_PROXY_PREFIX}/merge`,
  REPORTS: `${EXCEL_PROXY_PREFIX}/reports`,
  INTEGRATION: `${EXCEL_PROXY_PREFIX}/integration`,
  JOBS: (jobId: string) => `${EXCEL_PROXY_PREFIX}/jobs/${encodeURIComponent(jobId)}`,
} as const

export function excelRoute(path: string): string {
  return path.startsWith(EXCEL_PROXY_PREFIX)
    ? path
    : `${EXCEL_PROXY_PREFIX}${path.startsWith('/') ? path : `/${path}`}`
}
