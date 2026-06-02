'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useExcelApi } from '@/hooks/use-excel-api'
import { Button } from '@/components/ui/button'
import { Loader2, Upload } from 'lucide-react'

export default function DailyTemplateSettingsTab() {
  const api = useExcelApi()
  const [status, setStatus] = useState<{
    hasTemplate?: boolean
    originalName?: string
    uploadedAt?: string
    size?: number
  } | null>(null)
  const [aupStatus, setAupStatus] = useState<{
    hasAup?: boolean
    originalName?: string
    uploadedAt?: string
    size?: number
    mappingCount?: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadingAup, setUploadingAup] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [st, aup] = await Promise.all([api.dailyTemplateStatus(), api.dailyAupStatus()])
      setStatus(st)
      setAupStatus(aup)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h3 className="font-semibold text-gray-800">Шаблон выгрузки — Ежедневный учёт</h3>
        <p className="text-xs text-gray-500 mt-1 max-w-2xl">
          Файл Excel с листом «ЕЖЕДНЕВНЫЙ УЧЕТ» (заголовки в 5-й строке, данные с 6-й, A–P).
          При выгрузке сохраняются формулы и форматирование; все даты — ДД.ММ.ГГГГ.
        </p>
      </div>

      {loading ? (
        <p className="text-xs text-gray-500 flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Проверка…
        </p>
      ) : status?.hasTemplate ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-900">
          <p>
            <strong>Шаблон:</strong> {status.originalName || '—'}
          </p>
          {status.uploadedAt && (
            <p className="text-green-800 mt-0.5">
              Загружен: {new Date(status.uploadedAt).toLocaleString('ru-RU')}
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
          Шаблон не загружен — выгрузка в Excel недоступна.
        </p>
      )}

      <label className="inline-flex">
        <input
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            setUploading(true)
            setMsg(null)
            void (async () => {
              try {
                await api.dailyUploadTemplate(f)
                setMsg(`Шаблон сохранён: ${f.name}`)
                await load()
              } catch (err) {
                setMsg(err instanceof Error ? err.message : 'Ошибка')
              } finally {
                setUploading(false)
              }
            })()
          }}
        />
        <Button size="sm" disabled={uploading} asChild>
          <span>
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5 mr-1" />
            )}
            {status?.hasTemplate ? 'Заменить шаблон' : 'Загрузить шаблон'}
          </span>
        </Button>
      </label>

      <hr className="border-gray-200" />

      <div>
        <h3 className="font-semibold text-gray-800">АУП_РОП_ИТР.xlsx</h3>
        <p className="text-xs text-gray-500 mt-1 max-w-2xl">
          Справочник для «Общий» отчёт: столбец A — должность (сопоставление с «Должность» в ЕУ),
          столбец B — значение для столбца «Статус».
        </p>
      </div>

      {aupStatus?.hasAup ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-900">
          <p>
            <strong>Файл:</strong> {aupStatus.originalName || 'АУП_РОП_ИТР.xlsx'}
          </p>
          {aupStatus.mappingCount != null && (
            <p className="text-green-800">Записей в справочнике: {aupStatus.mappingCount}</p>
          )}
        </div>
      ) : (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
          Файл АУП_РОП_ИТР не загружен — при формировании «Общий» статусы по должности не подставятся.
        </p>
      )}

      <label className="inline-flex">
        <input
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          disabled={uploadingAup}
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            setUploadingAup(true)
            setMsg(null)
            void (async () => {
              try {
                await api.dailyUploadAup(f)
                setMsg(`АУП_РОП_ИТР сохранён: ${f.name}`)
                await load()
              } catch (err) {
                setMsg(err instanceof Error ? err.message : 'Ошибка')
              } finally {
                setUploadingAup(false)
              }
            })()
          }}
        />
        <Button size="sm" variant="outline" disabled={uploadingAup} asChild>
          <span>
            {uploadingAup ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5 mr-1" />
            )}
            {aupStatus?.hasAup ? 'Заменить АУП_РОП_ИТР' : 'Загрузить АУП_РОП_ИТР.xlsx'}
          </span>
        </Button>
      </label>

      {msg && <p className="text-xs text-gray-700">{msg}</p>}
    </div>
  )
}
