'use client'

import { useExcelStore } from '@/store/excel-store'
import { Loader2 } from 'lucide-react'

export function LoadingOverlay() {
  const isLoading = useExcelStore((s) => s.isLoading)

  if (!isLoading) return null

  return (
    <div className="fixed inset-0 z-40 bg-black/10 flex items-center justify-center pointer-events-auto">
      <div className="bg-white rounded-xl px-8 py-5 shadow-2xl flex items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-green-600" />
        <span className="text-sm text-gray-700 font-medium">Загрузка данных...</span>
      </div>
    </div>
  )
}