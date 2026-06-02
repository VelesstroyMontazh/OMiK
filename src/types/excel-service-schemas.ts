/**
 * TypeScript types aligned with mini-services/excel-service/schemas.py
 * Regenerate hint: npx quicktype --lang ts --src-lang schema schemas.json -o excel-service-schemas.ts
 */
export interface HealthResponse {
  status: string
  service?: string
  version?: string
  upload_dir?: string
  upload_dir_ready?: boolean
}

export interface TicketsRegistryLoadRequest {
  file_path: string
  registry: 'vsm' | 'sk'
  sheet_name?: string | null
}

export interface TicketsCostsLoadRequest {
  file_paths: string[]
  registry: 'vsm' | 'sk'
  sheet_name?: string | null
  append?: boolean
}

export interface TicketsCostsActionRequest {
  registry: 'vsm' | 'sk'
  fuzzy?: boolean
  fuzzy_fio_cutoff?: number
  run_dedupe?: boolean
}

export interface TicketsCostsSaveRowsRequest {
  registry: 'vsm' | 'sk'
  rows: Record<string, unknown>[]
}

export interface MergeScanRequest {
  folder_path: string
}

export interface CalendarLoadRequest {
  file_path?: string | null
}

export interface MainDbLoadRequest {
  file_path?: string | null
  sheet_name?: string | null
}

export interface ReportRequest {
  report_type: string
  year?: number | null
  month?: number | null
  citizenship?: string | null
  territory?: string | null
  organization?: string | null
}

export interface JobStatusResponse {
  job_id: string
  status: 'queued' | 'running' | 'done' | 'error'
  result?: Record<string, unknown>
  error?: string
}
