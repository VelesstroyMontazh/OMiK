'use client'

import { useExcelStore } from '@/store/excel-store'

export function ErrorNotification() {
  const error = useExcelStore((s) => s.error)
  const setError = useExcelStore((s) => s.setError)

  if (!error) return null

  return (
    <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
      <span>{error}</span>
      <button
        className="p-1 rounded hover:bg-red-100"
        onClick={() => setError(null)}
      >
        ×
      </button>
    </div>
  )
}