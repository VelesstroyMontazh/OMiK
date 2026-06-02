/** Shared HTTP helpers for excel API hooks. */
import { EXCEL_PROXY_PREFIX, excelRoute } from '@/lib/api-paths'

export const EXCEL_API_BASE = EXCEL_PROXY_PREFIX

export function apiUrl(path: string): string {
  return excelRoute(path)
}

type JsonError = { detail?: string; error?: string }

async function parseJson<T>(response: Response): Promise<T & JsonError> {
  return (await response.json().catch(() => ({}))) as T & JsonError
}

export async function excelJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(apiUrl(path), init)
  const data = await parseJson<T>(response)
  if (!response.ok) {
    throw new Error(data.detail || data.error || response.statusText)
  }
  return data
}

/** Next.js proxy routes (/api/excel/...). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- API payloads vary by route
export async function proxyJson<T = any>(
  path: string,
  init?: RequestInit,
  timeoutMs?: number,
): Promise<T> {
  const signal =
    timeoutMs != null && timeoutMs > 0
      ? AbortSignal.timeout(timeoutMs)
      : init?.signal
  const response = await fetch(path, { ...init, signal: signal ?? init?.signal })
  const data = await parseJson<T>(response)
  if (!response.ok) {
    throw new Error(data.detail || data.error || response.statusText)
  }
  return data
}
