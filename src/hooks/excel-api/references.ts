import { proxyJson } from '@/hooks/excel-api/http'
import type { createHealthApi } from '@/hooks/excel-api/health'

type HealthApi = ReturnType<typeof createHealthApi>

export function createReferencesApi({ ensureExcelBackend }: HealthApi) {
  const referencesStatus = async () => {
    await ensureExcelBackend({ lenient: true })
    return proxyJson('/api/excel/references?action=status', { method: 'GET' })
  }

  const referencesLoad = async () => {
    await ensureExcelBackend()
    return proxyJson('/api/excel/references?action=load', { method: 'POST' })
  }

  const referencesApply = async () => {
    await ensureExcelBackend()
    return proxyJson('/api/excel/references?action=apply', { method: 'POST' }, 600_000)
  }

  const referencesUpload = async (kind: 'territory' | 'podr' | 'login', file: File) => {
    await ensureExcelBackend()
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`/api/excel/references/upload?kind=${kind}`, {
      method: 'POST',
      body: form,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const detail = (data as { detail?: string }).detail
      throw new Error(
        detail
        || (data as { error?: string }).error
        || (res.status === 404
          ? 'Сервис справочников не найден — перезапустите excel-backend (RESTART-EXCEL.bat)'
          : 'Ошибка загрузки'),
      )
    }
    return data
  }

  /** Проверка файлов на диске без Python (если бэкенд ещё не обновлён). */
  const referencesLocalStatus = async () => {
    const res = await fetch('/api/excel/references/local-status')
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error((data as { error?: string }).error || 'Не удалось прочитать каталог справочников')
    }
    return data as {
      references_dir: string
      files: Record<string, boolean>
      resolved_files?: Record<string, string>
    }
  }

  return {
    referencesStatus,
    referencesLoad,
    referencesApply,
    referencesUpload,
    referencesLocalStatus,
  }
}
