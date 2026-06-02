import { NextResponse } from 'next/server'
import { apiSecretHeaders } from '@/lib/api-auth'

export const BACKEND_URL = process.env.EXCEL_BACKEND_URL ?? 'http://127.0.0.1:3031'

/** @deprecated Use BACKEND_URL */
export const EXCEL_BACKEND_URL = BACKEND_URL

const CONNECTION_ERROR_RE =
  /fetch failed|ECONNREFUSED|ECONNRESET|ENOTFOUND|EHOSTUNREACH|socket hang up|Failed to fetch/i

function isConnectionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  if (CONNECTION_ERROR_RE.test(err.message)) return true
  const cause = (err as Error & { cause?: unknown }).cause
  if (cause instanceof Error && CONNECTION_ERROR_RE.test(cause.message)) return true
  return false
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function mergeHeaders(init?: RequestInit): Headers {
  const headers = new Headers(init?.headers)
  for (const [k, v] of Object.entries(apiSecretHeaders())) {
    headers.set(k, v)
  }
  return headers
}

export async function pingExcelBackend(timeoutMs = 3000): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/health`, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: mergeHeaders(),
    })
    if (!res.ok) return false
    const data = (await res.json()) as { status?: string }
    return data.status === 'ok'
  } catch {
    return false
  }
}

export function errorDetail(err: unknown, timeoutMs: number): string {
  const isTimeout =
    err instanceof Error &&
    (err.name === 'TimeoutError' || /aborted|timeout/i.test(err.message))

  if (isTimeout) {
    const sec = Math.max(1, Math.round(timeoutMs / 1000))
    const hint =
      sec <= 60
        ? 'Сервер занят тяжёлой загрузкой или обработкой Excel — подождите или дождитесь завершения операции в статус-баре.'
        : 'Сервер занят или перегружен.'
    return (
      `Операция не завершилась за ${sec} с. ${hint} ` +
      'Подождите завершения загрузки в статус-баре или запустите RESTART-EXCEL.bat.'
    )
  }
  if (isConnectionError(err)) {
    return (
      'Связь с Excel-service (:3031) прервана. Подождите завершения операции в статус-баре или ' +
      'запустите RESTART-EXCEL.bat один раз.'
    )
  }
  if (err instanceof Error) {
    return err.message
  }
  return 'Ошибка соединения с сервисом Excel'
}

export async function fetchFromExcelBackend(
  path: string,
  init?: RequestInit,
  timeoutMs = 600_000,
): Promise<Response> {
  const maxAttempts = 3
  let lastError: unknown
  let triedLaunch = false

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fetch(`${BACKEND_URL}${path}`, {
        ...init,
        headers: mergeHeaders(init),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (err) {
      lastError = err
      if (!isConnectionError(err) || attempt === maxAttempts) {
        throw err
      }
      if (!triedLaunch) {
        triedLaunch = true
        const { ensureExcelBackendServer } = await import('@/lib/ensure-excel-backend')
        await ensureExcelBackendServer(60_000)
      }
      await sleep(1000 * attempt)
    }
  }

  throw lastError
}

/**
 * Proxy request to Python excel-service without throwing (avoids Next.js AbortError crashes).
 */
export async function proxyBackend(
  path: string,
  init?: RequestInit,
  timeoutMs = 600_000,
): Promise<NextResponse> {
  try {
    const res = await fetchFromExcelBackend(path, init, timeoutMs)
    const text = await res.text()
    let data: unknown
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      data = { detail: text || res.statusText }
    }
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    return NextResponse.json({ detail: errorDetail(err, timeoutMs) }, { status: 504 })
  }
}

/** Proxy binary/streaming response (downloads). */
export async function proxyBackendRaw(
  path: string,
  init?: RequestInit,
  timeoutMs = 600_000,
): Promise<NextResponse> {
  try {
    const res = await fetchFromExcelBackend(path, init, timeoutMs)
    if (!res.ok) {
      const text = await res.text()
      let data: unknown
      try {
        data = text ? JSON.parse(text) : { detail: res.statusText }
      } catch {
        data = { detail: text || res.statusText }
      }
      return NextResponse.json(data, { status: res.status })
    }
    const headers = new Headers()
    const contentType = res.headers.get('content-type')
    const contentDisposition = res.headers.get('content-disposition')
    const contentLength = res.headers.get('content-length')
    if (contentType) headers.set('Content-Type', contentType)
    if (contentDisposition) headers.set('Content-Disposition', contentDisposition)
    if (contentLength) headers.set('Content-Length', contentLength)
    if (!res.body) {
      return NextResponse.json({ detail: 'No response body from backend' }, { status: 500 })
    }
    return new NextResponse(res.body, { status: res.status, headers })
  } catch (err) {
    return NextResponse.json({ detail: errorDetail(err, timeoutMs) }, { status: 504 })
  }
}

/** Direct JSON fetch (throws on HTTP error). Prefer proxyBackend in route handlers. */
export async function backendFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
  timeoutMs = 600_000,
): Promise<T> {
  const response = await fetchFromExcelBackend(path, options, timeoutMs)
  if (!response.ok) {
    let errorMessage = response.statusText
    try {
      const body = (await response.json()) as { detail?: unknown }
      if (body.detail) {
        errorMessage =
          typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
      }
    } catch {
      // ignore
    }
    throw new Error(`Backend error (${response.status}): ${errorMessage}`)
  }
  return response.json() as Promise<T>
}
