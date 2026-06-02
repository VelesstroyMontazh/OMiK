'use client'

import { useCallback, useMemo, useState } from 'react'

export function cellText(v: unknown): string {
  if (v == null) return ''
  return String(v)
}

export function useColumnFilters<T extends Record<string, unknown>>(
  rows: T[],
  columnKeys: string[],
  getValue: (row: T, key: string) => string = (row, key) => cellText(row[key]).trim(),
  maxUniquePerCol = 200,
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled ?? true
  const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({})
  const [openFilterCol, setOpenFilterCol] = useState<string | null>(null)

  const uniqueByColumn = useMemo(() => {
    if (!enabled) return {} as Record<string, string[]>
    const map: Record<string, string[]> = {}
    for (const key of columnKeys) {
      const vals = new Set<string>()
      for (const row of rows) {
        const t = getValue(row, key)
        if (t) vals.add(t)
        if (vals.size > maxUniquePerCol) break
      }
      map[key] = Array.from(vals).sort((a, b) => a.localeCompare(b, 'ru'))
    }
    return map
  }, [rows, columnKeys, getValue, maxUniquePerCol, enabled])

  const filteredRows = useMemo(() => {
    if (!enabled) return rows
    let out = rows
    for (const [key, selected] of Object.entries(columnFilters)) {
      if (!selected?.size) continue
      out = out.filter((row) => selected.has(getValue(row, key)))
    }
    return out
  }, [rows, columnFilters, getValue, enabled])

  const toggleFilterValue = useCallback((colKey: string, value: string) => {
    setColumnFilters((prev) => {
      const next = { ...prev }
      const set = new Set(next[colKey] || [])
      if (set.has(value)) set.delete(value)
      else set.add(value)
      next[colKey] = set
      return { ...next }
    })
  }, [])

  const clearColFilter = useCallback((colKey: string) => {
    setColumnFilters((prev) => {
      const next = { ...prev }
      delete next[colKey]
      return next
    })
    setOpenFilterCol(null)
  }, [])

  const selectAllFilterValues = useCallback((colKey: string, values: string[]) => {
    setColumnFilters((prev) => ({
      ...prev,
      [colKey]: new Set(values),
    }))
  }, [])

  const selectNoneFilterValues = useCallback((colKey: string) => {
    setColumnFilters((prev) => {
      const next = { ...prev }
      delete next[colKey]
      return next
    })
  }, [])

  const clearAllFilters = useCallback(() => {
    setColumnFilters({})
    setOpenFilterCol(null)
  }, [])

  const hasActiveFilters = useMemo(
    () => Object.values(columnFilters).some((s) => s?.size),
    [columnFilters],
  )

  return {
    columnFilters,
    openFilterCol,
    setOpenFilterCol,
    uniqueByColumn,
    filteredRows,
    toggleFilterValue,
    clearColFilter,
    selectAllFilterValues,
    selectNoneFilterValues,
    clearAllFilters,
    hasActiveFilters,
    setColumnFilters,
  }
}
