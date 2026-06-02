'use client'

import { createExcelApi, type ExcelApi } from '@/hooks/excel-api'
import { useMemo } from 'react'

export type {
  UploadResult,
  FileListResult,
  SheetDataResult,
  MacroResult,
  AnalysisResult,
} from '@/hooks/excel-api/types'

export type { ExcelApi }

export function useExcelApi(): ExcelApi {
  return useMemo(() => createExcelApi(), [])
}
