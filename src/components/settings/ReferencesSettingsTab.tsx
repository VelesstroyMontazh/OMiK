'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useExcelApi } from '@/hooks/use-excel-api'
import { Button } from '@/components/ui/button'
import { BookOpen, CheckCircle2, Loader2, RefreshCw, Upload } from 'lucide-react'

const FILES = [
  {
    kind: 'territory' as const,
    name: '1С_Территория_в_Площадка.xlsx',
    hint: 'A: Территория из Базы → B: значение для столбца «Площадка» (бывший «Итого»)',
  },
  {
    kind: 'podr' as const,
    name: 'Подр_Площадка_Затраты.xlsx',
    hint: 'A: Подразделение → B: Площадка для «Затраты по билетам»',
  },
  {
    kind: 'login' as const,
    name: 'Login_Pass_Status.xlsx',
    hint: 'A: логин, B: пароль, C: площадки, D: статус (Актив. / Не актив.)',
  },
]

export default function ReferencesSettingsTab() {
  const api = useExcelApi()
  const [status, setStatus] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setErr(null)
    try {
      const s = (await api.referencesStatus()) as Record<string, unknown>
      setStatus(s)
    } catch (e) {
      try {
        const local = await api.referencesLocalStatus()
        setStatus(local as Record<string, unknown>)
        setErr(
          (e instanceof Error ? e.message : 'Ошибка статуса')
          + ' — показаны файлы с диска; для «Применить» перезапустите excel-backend.',
        )
      } catch {
        setErr(e instanceof Error ? e.message : 'Ошибка статуса')
      }
    }
  }, [api])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const onUpload = async (kind: 'territory' | 'podr' | 'login', file: File) => {
    setErr(null)
    setMsg(null)
    setLoading(true)
    try {
      await api.referencesUpload(kind, file)
      await api.referencesLoad()
      setMsg(`Файл загружен: ${file.name}`)
      await refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  const onApply = async () => {
    setErr(null)
    setMsg(null)
    setLoading(true)
    try {
      const r = (await api.referencesApply()) as {
        main_db?: { filled_ploshchadka?: number; filled_status?: number; row_count?: number }
        tickets_hint?: string
      }
      const m = r.main_db
      setMsg(
        `Справочники применены. Площадка: ${m?.filled_ploshchadka ?? 0} строк, Статус: ${m?.filled_status ?? 0}. ${r.tickets_hint || ''}`,
      )
      await refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка применения')
    } finally {
      setLoading(false)
    }
  }

  const filesOnDisk = (status?.files || {}) as Record<string, boolean>
  const counts = (status?.counts || {}) as Record<string, number>
  const refDir = String(status?.references_dir || 'upload/справочники')

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-start gap-2 text-gray-600">
        <BookOpen className="h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <p className="font-medium text-gray-800">Справочники</p>
          <p className="text-xs mt-1">
            Каталог: <code className="bg-gray-100 px-1 rounded">{refDir}</code>
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        {FILES.map((f) => (
          <div key={f.kind} className="rounded-lg border border-gray-200 p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-gray-800">{f.name}</span>
              {filesOnDisk[f.name] ? (
                <span className="text-xs text-green-700 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  на диске
                  {(status?.resolved_files as Record<string, string> | undefined)?.[
                    f.kind === 'territory' ? 'territory_name' : f.kind === 'podr' ? 'podr_name' : 'login_name'
                  ] ? (
                    <span className="text-gray-500 truncate max-w-[180px]">
                      (
                      {
                        (status?.resolved_files as Record<string, string>)[
                          f.kind === 'territory' ? 'territory_name' : f.kind === 'podr' ? 'podr_name' : 'login_name'
                        ]
                      }
                      )
                    </span>
                  ) : null}
                </span>
              ) : (
                <span className="text-xs text-amber-700">файл не найден</span>
              )}
            </div>
            <p className="text-xs text-gray-500">{f.hint}</p>
            <label className="inline-flex">
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                disabled={loading}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void onUpload(f.kind, file)
                  e.target.value = ''
                }}
              />
              <Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled={loading} asChild>
                <span>
                  <Upload className="h-3.5 w-3.5 mr-1" />
                  Загрузить
                </span>
              </Button>
            </label>
          </div>
        ))}
      </div>

      {counts && Object.keys(counts).length > 0 && (
        <p className="text-xs text-gray-500">
          В кэше: территория→площадка {counts.territory_to_site ?? 0}, подр→площадка{' '}
          {counts.podr_to_site ?? 0}, пользователей {counts.users ?? 0}, статусов площадок{' '}
          {counts.site_status ?? 0}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => void refresh()}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          Обновить статус
        </Button>
        <Button
          type="button"
          size="sm"
          className="bg-amber-600 hover:bg-amber-700"
          disabled={loading}
          onClick={() => void onApply()}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
          Применить справочники
        </Button>
      </div>

      {msg && <p className="text-xs text-green-700">{msg}</p>}
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  )
}
