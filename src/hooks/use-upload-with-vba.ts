'use client'

import { useCallback } from 'react'
import { useExcelApi, type UploadResult } from '@/hooks/use-excel-api'
import { useVbaPrompt } from '@/contexts/VbaPromptContext'

/** Загрузка файла + проверка VBA и диалог «Лаборатория». */
export function useUploadWithVba() {
  const api = useExcelApi()
  const { checkFileForVba } = useVbaPrompt()

  const uploadFile = useCallback(
    async (file: File): Promise<UploadResult> => {
      const result = await api.uploadFile(file)
      void checkFileForVba(result.file_path, result.original_filename)
      return result
    },
    [api, checkFileForVba],
  )

  return { ...api, uploadFile }
}
