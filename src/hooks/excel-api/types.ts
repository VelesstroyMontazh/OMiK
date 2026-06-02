/** Shared types for excel API client. */

export interface UploadResult {
  file_id: string
  original_filename: string
  stored_filename: string
  file_path: string
  file_size: number
  extension: string
  sheets: string[]
  upload_time: string
}

export interface FileListResult {
  files: Array<{
    file_id: string
    stored_filename: string
    file_path: string
    file_size: number
    extension: string
    modified: string
    sheets?: string[]
  }>
  count: number
}

export interface SheetDataResult {
  sheet_name: string
  data: Array<Array<{
    row: number
    col: number
    value: unknown
    type: string
  }>>
  range: string
  total_rows: number
  returned_rows: number
  has_more: boolean
  columns: number
}

export interface MacroResult {
  success: boolean
  output: string[]
  errors: string[]
  variables?: Record<string, string>
}

export interface AnalysisResult {
  analysis: Record<string, Record<string, unknown>>
  operations: string[]
  numeric_columns: string[]
  total_rows: number
  total_columns: number
  message?: string
}
