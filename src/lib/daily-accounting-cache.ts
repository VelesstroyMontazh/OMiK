/** In-memory cache for «Ежедневный учёт» — survives panel unmount within the browser session. */

export type DailyCacheRow = Record<string, unknown>

type CacheEntry = { rows: DailyCacheRow[] }

const store: Record<string, CacheEntry> = {}
const inFlight = new Map<string, Promise<DailyCacheRow[]>>()

export function dailyCacheKey(date: string, site: string, combined: boolean): string {
  return combined ? `${date}|__combined__` : `${date}|${site}`
}

export function dailyCacheGet(key: string): DailyCacheRow[] | undefined {
  return store[key]?.rows
}

export function dailyCacheHas(key: string): boolean {
  return key in store
}

export function dailyCacheIsLoading(key: string): boolean {
  return inFlight.has(key) && !dailyCacheHas(key)
}

export function dailyCacheSet(key: string, rows: DailyCacheRow[]): void {
  store[key] = { rows }
  inFlight.delete(key)
}

export function dailyCacheInvalidate(prefix?: string): void {
  if (!prefix) {
    for (const k of Object.keys(store)) delete store[k]
    inFlight.clear()
    return
  }
  for (const k of Object.keys(store)) {
    if (k.startsWith(prefix)) {
      delete store[k]
      inFlight.delete(k)
    }
  }
}

export async function dailyCacheFetch(
  key: string,
  loader: () => Promise<DailyCacheRow[]>,
  onChange?: () => void,
): Promise<DailyCacheRow[]> {
  const hit = store[key]
  if (hit) return hit.rows

  const pending = inFlight.get(key)
  if (pending) return pending

  onChange?.()
  const promise = loader()
    .then((rows) => {
      store[key] = { rows }
      inFlight.delete(key)
      onChange?.()
      return rows
    })
    .catch(() => {
      store[key] = { rows: [] }
      inFlight.delete(key)
      onChange?.()
      return []
    })

  inFlight.set(key, promise)
  return promise
}
