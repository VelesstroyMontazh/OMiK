'use client'

import { useEffect } from 'react'
import { useExcelStore, type FileInfo } from '@/store/excel-store'
import { useExcelApi } from '@/hooks/use-excel-api'
import { VbaPromptProvider } from '@/contexts/VbaPromptContext'
import { MainInterface } from '@/components/home/MainInterface'

export default function HomePageClient() {
  const api = useExcelApi()
  const setFiles = useExcelStore((s) => s.setFiles)
  const setBackendAvailable = useExcelStore((s) => s.setBackendAvailable)

  useEffect(() => {
    let cancelled = false

    const pingBackend = async () => {
      try {
        const available = await api.checkHealth()
        if (!cancelled) setBackendAvailable(available)
        return available
      } catch {
        if (!cancelled) setBackendAvailable(false)
        return false
      }
    }

    void (async () => {
      const ok = await pingBackend()
      if (cancelled) return

      if (!ok) {
        try {
          await api.ensureExcelBackend({ lenient: true })
          await pingBackend()
        } catch {
          /* UI stays usable; retry on interval */
        }
      }

      if (cancelled) return
      try {
        const result = await api.fetchFiles()
        if (cancelled) return
        const mappedFiles: FileInfo[] = result.files.map((f) => ({
          id: f.file_id,
          name: f.stored_filename,
          createdAt: new Date(f.modified).getTime(),
          updatedAt: new Date(f.modified).getTime(),
          size: f.file_size,
          filePath: f.file_path,
          sheets: f.sheets,
          extension: f.extension,
        }))
        setFiles(mappedFiles)
      } catch {
        /* file list optional on first paint */
      }
    })()

    const timer = setInterval(() => void pingBackend(), 60_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [api, setFiles, setBackendAvailable])

  return (
    <VbaPromptProvider>
      <MainInterface />
    </VbaPromptProvider>
  )
}
