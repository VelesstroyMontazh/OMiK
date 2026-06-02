import { apiUrl } from '@/hooks/excel-api/http'
import type { FileListResult, UploadResult } from '@/hooks/excel-api/types'
import { excelBackendJson, getExcelBackendUrl } from '@/lib/excel-backend-direct'

const UPLOAD_TIMEOUT_MS = 600_000

const CONNECTION_HINT =
  'Excel-service не отвечает. Подождите или запустите RESTART-EXCEL.bat один раз.'

function parseUploadError(payload: unknown, status: number): string {
  if (payload && typeof payload === 'object') {
    const p = payload as { detail?: unknown; error?: unknown }
    const raw = p.detail ?? p.error
    if (typeof raw === 'string' && raw.trim()) return raw
    if (raw != null) return JSON.stringify(raw)
  }
  if (status === 413) {
    return 'Файл слишком большой для прокси Next.js. Перезапустите next dev после обновления next.config (proxyClientMaxBodySize).'
  }
  if (status === 503) return CONNECTION_HINT
  return `Ошибка загрузки (HTTP ${status})`
}

function wrapUploadFetchError(err: unknown): Error {
  if (err instanceof Error) {
    if (/fetch failed|Failed to fetch|ECONNREFUSED/i.test(err.message)) {
      return new Error(CONNECTION_HINT)
    }
    const cause = (err as Error & { cause?: unknown }).cause
    if (cause instanceof Error && /ECONNREFUSED/i.test(cause.message)) {
      return new Error(CONNECTION_HINT)
    }
  }
  return err instanceof Error ? err : new Error(String(err))
}

/** Прямой upload на :3031 для файлов >10MB (обход лимита body в Next). */
async function uploadFileDirect(
  file: File,
  backendUrl: string,
  token?: string,
): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('file', file)
  const headers: HeadersInit = {}
  if (token) headers['X-OMIK-Token'] = token

  const response = await fetch(`${backendUrl.replace(/\/$/, '')}/api/upload`, {
    method: 'POST',
    body: formData,
    headers,
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(parseUploadError(data, response.status))
  }
  return data as UploadResult
}

export function createFilesApi() {
  const uploadFile = async (file: File): Promise<UploadResult> => {
    const sizeMb = file.size / (1024 * 1024)
    const backendUrl = process.env.NEXT_PUBLIC_EXCEL_BACKEND_URL?.trim()
    const token = process.env.NEXT_PUBLIC_OMIK_API_SECRET?.trim()

    if (backendUrl) {
      try {
        return await uploadFileDirect(file, backendUrl, token)
      } catch (directErr) {
        const directMsg = directErr instanceof Error ? directErr.message : String(directErr)
        console.warn('Direct excel upload failed, trying Next proxy:', directMsg)
      }
    }

    const formData = new FormData()
    formData.append('file', file)
    let response: Response
    try {
      response = await fetch(apiUrl('/upload'), {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
      })
    } catch (err) {
      throw wrapUploadFetchError(err)
    }
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(parseUploadError(data, response.status))
    }
    if (sizeMb > 10) {
      console.info(`Uploaded ${file.name} (${sizeMb.toFixed(1)} MB) via Next proxy`)
    }
    return data as UploadResult
  }

  const fetchFiles = async (options?: { includeSheets?: boolean }): Promise<FileListResult> => {
    const includeSheets = options?.includeSheets === true
    const base = getExcelBackendUrl()
    if (base) {
      const qs = includeSheets ? '?include_sheets=true' : ''
      return excelBackendJson<FileListResult>(`/api/files${qs}`, { method: 'GET' }, 60_000)
    }
    const qs = includeSheets ? '?include_sheets=true' : ''
    const response = await fetch(`${apiUrl('/files')}${qs}`, {
      method: 'GET',
      signal: AbortSignal.timeout(60_000),
    })
    if (!response.ok) throw new Error('Ошибка получения списка файлов')
    return response.json()
  }

  const deleteFile = async (id: string): Promise<void> => {
    const response = await fetch(apiUrl(`/files/${id}`), { method: 'DELETE' })
    if (!response.ok) throw new Error('Ошибка удаления файла')
  }

  const downloadFile = async (id: string): Promise<void> => {
    const response = await fetch(apiUrl(`/download/${id}`), { method: 'GET' })
    if (!response.ok) throw new Error('Ошибка скачивания файла')
    const blob = await response.blob()
    const contentDisposition = response.headers.get('content-disposition')
    let filename = 'download.xlsx'
    if (contentDisposition) {
      const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      if (match?.[1]) filename = match[1].replace(/['"]/g, '')
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getFile = async (id: string) => {
    const response = await fetch(apiUrl(`/files/${id}`), { method: 'GET' })
    if (!response.ok) throw new Error('Ошибка получения информации о файле')
    return response.json()
  }

  return { uploadFile, fetchFiles, deleteFile, downloadFile, getFile }
}
