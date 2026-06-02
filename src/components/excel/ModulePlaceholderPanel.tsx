'use client'

import { Construction } from 'lucide-react'
import { getHomeModule } from '@/lib/home-modules'
import { useExcelStore } from '@/store/excel-store'

export default function ModulePlaceholderPanel() {
  const activeFile = useExcelStore((s) => s.activeFile)
  const mod = getHomeModule(activeFile?.id)
  const title = mod?.title ?? activeFile?.name ?? 'Раздел'

  return (
    <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-slate-100 p-8">
      <div className="text-center max-w-md">
        <Construction className="h-14 w-14 text-slate-400 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        <p className="text-sm text-gray-600 mt-2">
          {mod?.subtitle ?? 'Модуль подключается. Функционал появится в следующих версиях.'}
        </p>
        <p className="text-[11px] text-gray-400 mt-4">
          Нажмите «Назад» в верхней панели, чтобы вернуться на предыдущий экран.
        </p>
      </div>
    </div>
  )
}
