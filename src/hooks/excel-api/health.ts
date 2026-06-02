import { EXCEL_ROUTES } from '@/lib/api-paths'
import { getExcelBackendUrl } from '@/lib/excel-backend-direct'

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

let lastHealthOk = false
let lastHealthAt = 0
const HEALTH_CACHE_MS = 8_000

async function pingHealth(timeoutMs: number): Promise<boolean> {
  const direct = getExcelBackendUrl()
  const url = direct ? `${direct}/api/health` : EXCEL_ROUTES.HEALTH
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) return false
    const data = (await response.json()) as { status?: string }
    return data.status === 'ok'
  } catch {
    return false
  }
}

export type EnsureExcelOptions = {
  lenient?: boolean
}

export function createHealthApi() {
  const checkHealth = async (): Promise<boolean> => {
    const now = Date.now()
    if (now - lastHealthAt < HEALTH_CACHE_MS) {
      return lastHealthOk
    }

    const ok = await pingHealth(5000)
    lastHealthOk = ok
    lastHealthAt = Date.now()
    if (ok) return true

    await sleep(1000)
    const retry = await pingHealth(8000)
    lastHealthOk = retry
    lastHealthAt = Date.now()
    return retry
  }

  /** Автозапуск excel через Next.js (сервер), без START.bat вручную. */
  const ensureExcelBackend = async (options?: EnsureExcelOptions): Promise<void> => {
    const lenient = options?.lenient === true

    if (await checkHealth()) return

    try {
      const response = await fetch('/api/excel/ensure', {
        method: 'GET',
        signal: AbortSignal.timeout(lenient ? 120_000 : 95_000),
      })
      const data = (await response.json()) as { status?: string; detail?: string }
      if (data.status === 'ok') {
        lastHealthOk = true
        lastHealthAt = Date.now()
        return
      }
      if (lenient && (data.status === 'busy' || response.status === 503)) return
    } catch {
      /* fall through */
    }

    if (await checkHealth()) return

    throw new Error(
      'Excel на :3031 не отвечает. Дважды щёлкните RESTART-EXCEL.bat в папке проекта, затем F5.',
    )
  }

  return { checkHealth, ensureExcelBackend }
}
