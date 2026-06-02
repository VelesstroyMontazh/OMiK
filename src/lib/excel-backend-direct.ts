/** Прямые запросы к excel-service (:3031) — обход таймаутов Next.js proxy. */

const HEAVY_TIMEOUT_MS = 1_800_000

export function getExcelBackendUrl(): string {
  return process.env.NEXT_PUBLIC_EXCEL_BACKEND_URL?.replace(/\/$/, '') || ''
}

function backendHeaders(init?: RequestInit): Headers {
  const headers = new Headers(init?.headers)
  const secret = process.env.NEXT_PUBLIC_OMIK_API_SECRET?.trim()
  if (secret) headers.set('X-OMIK-Token', secret)
  if (!headers.has('Content-Type') && init?.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json')
  }
  return headers
}

export async function excelBackendJson<T>(
  path: string,
  init?: RequestInit,
  timeoutMs = HEAVY_TIMEOUT_MS,
): Promise<T> {
  const base = getExcelBackendUrl()
  if (!base) {
    throw new Error('NEXT_PUBLIC_EXCEL_BACKEND_URL не задан в .env.local')
  }
  let response: Response
  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      headers: backendHeaders(init),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/fetch failed|Failed to fetch|ECONNREFUSED|aborted|timeout/i.test(msg)) {
      throw new Error(
        'Нет связи с Excel-service (:3031). Подождите завершения операции или ' +
          'запустите RESTART-EXCEL.bat один раз.',
      )
    }
    throw err
  }
  const data = (await response.json().catch(() => ({}))) as T & { detail?: string; error?: string }
  if (!response.ok) {
    throw new Error(data.detail || data.error || response.statusText)
  }
  return data
}

export type JobRecord = {
  id?: string
  status?: string
  error?: string | null
  result?: unknown
  phase?: string | null
  progress_detail?: string | null
}

export async function pollExcelJob(
  jobId: string,
  getJob: (id: string) => Promise<JobRecord>,
  options?: {
    timeoutMs?: number
    intervalMs?: number
    onTick?: (job: JobRecord) => void
  },
): Promise<unknown> {
  const timeoutMs = options?.timeoutMs ?? HEAVY_TIMEOUT_MS
  const intervalMs = options?.intervalMs ?? 2000
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const job = await getJob(jobId)
    options?.onTick?.(job)
    const status = job.status || ''
    if (status === 'done') {
      return job.result
    }
    if (status === 'error') {
      throw new Error(job.error || 'Ошибка фоновой задачи на сервере')
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }

  throw new Error(
    `Превышено время ожидания (${Math.round(timeoutMs / 60_000)} мин). ` +
      'Если excel-service занят — подождите и нажмите F5. Не перезапускайте во время обработки.',
  )
}
