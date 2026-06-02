'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useExcelApi } from '@/hooks/use-excel-api'
import { Button } from '@/components/ui/button'
import PathInputWithBrowse from '@/components/excel/PathInputWithBrowse'
import { isUnderMainDbUpload, mainDbUploadError, MAIN_DB_UPLOAD_DIR } from '@/lib/main-db-upload'
import { Database, Loader2, CheckCircle2, Download, Trash2, Play } from 'lucide-react'

export type MainDbInstance = {
  id: string
  source_excel: string
  file_name: string
  loaded_at?: string
  row_count?: number
  is_active?: boolean
}

function formatLoadedAt(iso?: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('ru-RU')
  } catch {
    return iso
  }
}

export default function MainDbSettingsTab() {
  const api = useExcelApi()
  const [instances, setInstances] = useState<MainDbInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [excelPath, setExcelPath] = useState('')
  const [uploading, setUploading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = (await api.mainDbInstances()) as {
        instances?: MainDbInstance[]
      }
      setInstances(data.instances || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handleLoad = async () => {
    const path = excelPath.trim()
    if (!path) {
      window.alert('Укажите путь к файлу Excel в папке upload.')
      return
    }
    if (!isUnderMainDbUpload(path)) {
      window.alert(mainDbUploadError(MAIN_DB_UPLOAD_DIR))
      return
    }
    setUploading(true)
    try {
      await api.mainDbLoad(path, { forceReload: false, setActive: false })
      await refresh()
      window.alert('База загружена параллельно. Нажмите «Задействовать», чтобы сделать её основной.')
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Ошибка загрузки')
    } finally {
      setUploading(false)
    }
  }

  const handleActivate = async (id: string) => {
    setBusyId(id)
    try {
      await api.mainDbActivate(id)
      await refresh()
      window.alert(
        'База задействована как основная. Если вкладка «Основная База» уже открыта — закройте и откройте её снова.',
      )
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setBusyId(null)
    }
  }

  const handleVerify = async (id: string) => {
    setBusyId(id)
    try {
      const r = (await api.mainDbVerifyInstance(id)) as {
        row_count?: number
        col_count?: number
        size_mb?: number
        file_name?: string
      }
      window.alert(
        `Проверка «${r.file_name || id}»:\n`
        + `Строк: ${r.row_count ?? '?'}\n`
        + `Столбцов: ${r.col_count ?? '?'}\n`
        + `Размер SQLite: ${r.size_mb ?? '?'} МБ`,
      )
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Ошибка проверки')
    } finally {
      setBusyId(null)
    }
  }

  const handleExport = (id: string) => {
    window.open(api.mainDbExportInstanceUrl(id), '_blank')
  }

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Удалить базу «${name}» из программы?`)) return
    setBusyId(id)
    try {
      await api.mainDbDeleteInstance(id)
      await refresh()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Ошибка удаления')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-800">Загрузить новую базу</h3>
        <p className="text-xs text-gray-600">
          Каждая загрузка создаёт отдельную копию в программе и не перезаписывает ранее загруженные базы.
        </p>
        <PathInputWithBrowse
          value={excelPath}
          onChange={setExcelPath}
          mode="file"
          placeholder={`${MAIN_DB_UPLOAD_DIR}\\Отчет_База.xlsx`}
          inputClassName="h-9 w-full rounded-lg border border-gray-300 px-2 text-xs bg-white"
        />
        <Button
          className="bg-amber-600 hover:bg-amber-700"
          disabled={uploading || !excelPath.trim()}
          onClick={() => void handleLoad()}
        >
          {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Database className="h-4 w-4 mr-2" />}
          Загрузить базу
        </Button>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Загруженные базы</h3>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Загрузка списка…
          </div>
        ) : instances.length === 0 ? (
          <p className="text-sm text-gray-500">Пока нет загруженных баз.</p>
        ) : (
          <ul className="space-y-3">
            {instances.map((inst) => {
              const busy = busyId === inst.id
              const label = inst.file_name || inst.source_excel || inst.id
              return (
                <li
                  key={inst.id}
                  className="rounded-lg border border-gray-200 bg-white p-3 flex flex-col sm:flex-row sm:items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 truncate">{label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Загружено: {formatLoadedAt(inst.loaded_at)}
                      {inst.row_count ? ` • ${inst.row_count.toLocaleString('ru-RU')} строк` : ''}
                    </div>
                    {inst.is_active && (
                      <span className="inline-flex mt-1 items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-green-700 bg-green-50 px-2 py-0.5 rounded">
                        <CheckCircle2 className="h-3 w-3" />
                        активная
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 shrink-0">
                    {!inst.is_active && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        disabled={busy}
                        onClick={() => void handleActivate(inst.id)}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Задействовать
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      disabled={busy}
                      onClick={() => void handleVerify(inst.id)}
                    >
                      Проверить
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      disabled={busy}
                      onClick={() => handleExport(inst.id)}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Выгрузить
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs text-red-700 border-red-200 hover:bg-red-50"
                      disabled={busy}
                      onClick={() => void handleDelete(inst.id, label)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Удалить
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
