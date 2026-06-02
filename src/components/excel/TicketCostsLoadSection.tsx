'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useExcelApi } from '@/hooks/use-excel-api'
import { useUploadWithVba } from '@/hooks/use-upload-with-vba'
import { useVbaPrompt } from '@/contexts/VbaPromptContext'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import PathInputWithBrowse from '@/components/excel/PathInputWithBrowse'
import FilterableDataTable from '@/components/excel/FilterableDataTable'
import TicketCostsActionStatusBar from '@/components/excel/TicketCostsActionStatusBar'
import { REGISTRY_LABELS, type RegistryId } from '@/components/excel/ticketCostsRegistries'
import { prepareRegistryClear } from '@/components/excel/ticketCostsCache'
import { useTicketCostsActionStatus } from '@/components/excel/useTicketCostsActionStatus'
import {
  Eraser,
  Eye,
  FileSpreadsheet,
  FolderOpen,
  GitMerge,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react'

const TICKET_EXTENSIONS = new Set(['.xlsx', '.xlsm', '.xls'])

interface PendingFile {
  id: string
  name: string
  path: string
  fileId?: string
}

interface StoredFile {
  file_id: string
  original_name: string
  uploaded_at?: string
  row_count?: number
}

interface UploadQueueItem {
  id: string
  name: string
  path: string
  file_id?: string
  added_at?: string
}

interface ProcessingRun {
  run_id: string
  run_type: string
  label: string
  created_at: string
  row_count: number
  active?: number
}

interface PreviewCol {
  key: string
  title: string
}

function newPendingId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export default function TicketCostsLoadSection({
  registry,
  showActionStatusBar = true,
  storedFiles,
  uploadQueue = [],
  processingRuns,
  statusLoading = false,
  rawRows = 0,
  fuzzyFioPercent,
  onFuzzyPercentChange: _onFuzzyPercentChange,
  onRefreshStatus,
  onDataChanged,
  onOpenTable,
  onPrepareClear,
}: {
  registry: RegistryId
  showActionStatusBar?: boolean
  storedFiles: StoredFile[]
  uploadQueue?: UploadQueueItem[]
  processingRuns: ProcessingRun[]
  statusLoading?: boolean
  rawRows?: number
  fuzzyFioPercent: number
  onFuzzyPercentChange: (n: number) => void
  onRefreshStatus: (background?: boolean) => Promise<unknown>
  onDataChanged: () => void
  onOpenTable: () => void
  /** Закрыть таблицу / отменить запросы перед очисткой реестра */
  onPrepareClear?: (registry: RegistryId) => void | Promise<void>
}) {
  const api = useExcelApi()
  const { uploadFile } = useUploadWithVba()
  const { checkFileForVba } = useVbaPrompt()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [folderPath, setFolderPath] = useState('')
  const [manualPath, setManualPath] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewCols, setPreviewCols] = useState<PreviewCol[]>([])
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([])
  const [previewMeta, setPreviewMeta] = useState<{ name: string; total: number } | null>(null)
  const [previewStoredPath, setPreviewStoredPath] = useState<string | null>(null)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [runPreviewLoading, setRunPreviewLoading] = useState(false)
  const [runPreviewCols, setRunPreviewCols] = useState<PreviewCol[]>([])
  const [runPreviewRows, setRunPreviewRows] = useState<Record<string, unknown>[]>([])
  const {
    status: actionStatusState,
    reset: resetActionStatus,
    runAction: runLoadAction,
  } = useTicketCostsActionStatus({ persistent: true })
  const busy = actionStatusState?.active || uploading || loading
  const filesListLoading = statusLoading && storedFiles.length === 0
  const historyListLoading = statusLoading && processingRuns.length === 0

  const persistQueueItems = useCallback(
    async (items: PendingFile[]) => {
      if (!items.length) return
      try {
        await api.ticketsCostsQueueAdd(
          registry,
          items.map((i) => ({
            id: i.id,
            name: i.name,
            path: i.path,
            fileId: i.fileId,
          })),
        )
      } catch {
        /* очередь на сервере — best-effort */
      }
    },
    [api, registry],
  )

  useEffect(() => {
    void onRefreshStatus(true)
  }, [registry, onRefreshStatus])

  useEffect(() => {
    const serverKeys = new Set(
      uploadQueue.map((q) => (q.path || q.file_id || '').toLowerCase()).filter(Boolean),
    )
    const fromServer: PendingFile[] = uploadQueue.map((q) => {
      const path = q.path || ''
      return {
        id: q.id || newPendingId(),
        name: q.name || path.split(/[/\\]/).pop() || path,
        path,
        fileId: q.file_id,
      }
    })
    setPendingFiles((prev) => {
      const localOnly = prev.filter((p) => {
        const key = (p.path || p.fileId || '').toLowerCase()
        return key && !serverKeys.has(key)
      })
      if (!fromServer.length && !localOnly.length) return prev
      const merged = [...fromServer]
      const seen = new Set(merged.map((p) => (p.path || p.fileId || '').toLowerCase()))
      for (const p of localOnly) {
        const key = (p.path || p.fileId || '').toLowerCase()
        if (!seen.has(key)) {
          seen.add(key)
          merged.push(p)
        }
      }
      return merged
    })
  }, [uploadQueue, registry])

  const removeLoadedFromPending = useCallback((paths: string[]) => {
    const keys = new Set(paths.map((p) => p.toLowerCase()))
    setPendingFiles((prev) =>
      prev.filter((f) => !keys.has((f.path || f.fileId || f.name).toLowerCase())),
    )
  }, [])

  const addPathsToQueue = useCallback((items: PendingFile[]) => {
    if (!items.length) return
    for (const item of items) {
      void checkFileForVba(item.path, item.name)
    }
    setPendingFiles((prev) => {
      const seen = new Set(prev.map((p) => p.path.toLowerCase()))
      const next = [...prev]
      for (const item of items) {
        const key = item.path.toLowerCase()
        if (!seen.has(key)) {
          seen.add(key)
          next.push(item)
        }
      }
      return next
    })
    void persistQueueItems(items)
  }, [checkFileForVba, persistQueueItems])

  const uploadBrowserFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return
      setError(null)
      const list = Array.from(files).filter((f) => {
        const ext = f.name.includes('.') ? `.${f.name.split('.').pop()?.toLowerCase()}` : ''
        return TICKET_EXTENSIONS.has(ext)
      })
      if (!list.length) {
        setError('Выберите файлы .xlsx, .xlsm или .xls')
        return
      }
      try {
        const stepLabels = [
          'Подготовка',
          ...list.map((f, i) => `Файл ${i + 1} из ${list.length}: ${f.name.length > 36 ? `${f.name.slice(0, 33)}…` : f.name}`),
          'Добавление в очередь',
        ]
        await runLoadAction(
          'Загрузка файлов на сервер',
          stepLabels,
          async ({ advance, setDetail, startElapsedTimer }) => {
            setUploading(true)
            const added: PendingFile[] = []
            startElapsedTimer('Загрузка на сервер')
            advance()
            for (let i = 0; i < list.length; i++) {
              const file = list[i]
              const sizeMb = (file.size / (1024 * 1024)).toFixed(1)
              setDetail(`Отправка ${i + 1}/${list.length}: ${file.name} (${sizeMb} MB)`)
              try {
                const result = await uploadFile(file)
                added.push({
                  id: newPendingId(),
                  name: file.name,
                  path: (result.file_path || result.stored_filename || file.name) as string,
                  fileId: result.file_id,
                })
              } catch (err) {
                if (added.length) addPathsToQueue(added)
                const detail = err instanceof Error ? err.message : 'Ошибка загрузки'
                throw new Error(`Файл ${i + 1}/${list.length} «${file.name}» (${sizeMb} MB): ${detail}`)
              }
              advance()
            }
            addPathsToQueue(added)
            advance()
            return `На сервер загружено: ${added.length} файл(ов)`
          },
        )
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки на сервер')
      } finally {
        setUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    },
    [runLoadAction, addPathsToQueue, uploadFile],
  )

  const handleScanFolder = useCallback(async () => {
    const dir = folderPath.trim()
    if (!dir) {
      setError('Укажите папку')
      return
    }
    setError(null)
    try {
      await runLoadAction(
        'Сканирование папки',
        ['Поиск Excel-файлов', 'Добавление в очередь'],
        async ({ advance, startElapsedTimer }) => {
          startElapsedTimer('Сканирование')
          advance()
          const result = await api.scanMergeFolder(dir)
          const files = ((result as { files?: { name: string; file_path: string; extension?: string }[] }).files || [])
            .filter((f) => TICKET_EXTENSIONS.has((f.extension || '').toLowerCase()) || /\.(xlsx|xlsm|xls)$/i.test(f.name))
            .map((f) => ({ id: newPendingId(), name: f.name, path: f.file_path }))
          if (!files.length) throw new Error('В папке нет Excel-файлов')
          advance()
          addPathsToQueue(files)
          return `Найдено и добавлено: ${files.length} файл(ов)`
        },
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сканирования')
    }
  }, [runLoadAction, addPathsToQueue, api, folderPath])

  const handleLoad = async (append: boolean) => {
    const paths = pendingFiles.map((f) => f.path || f.fileId || f.name).filter(Boolean)
    if (!paths.length) {
      setError('Добавьте хотя бы один файл в очередь')
      return
    }
    setError(null)
    try {
      await runLoadAction(
        append ? 'Добавление к загруженным' : 'Загрузка в реестр',
        [
          'Проверка файлов',
          'Чтение Excel (заголовки — строка 4)',
          'Нормализация операций (Возврат → Возврат+Сбор)',
          'Копирование в хранилище программы',
          'Запись в базу raw_import',
          'Обновление статуса',
        ],
        async ({ advance, setDetail, startElapsedTimer }) => {
          startElapsedTimer('Загрузка (крупные файлы — несколько минут)')
          advance()
          setDetail(`${paths.length} файл(ов) → ${REGISTRY_LABELS[registry]}`)
          const r = await api.ticketsCostsLoad({ file_paths: paths, registry, append })
          advance()
          advance()
          advance()
          advance()
          await onRefreshStatus(true)
          advance()
          removeLoadedFromPending(paths)
          onDataChanged()
          const loaded = (r as { files_loaded?: number }).files_loaded ?? paths.length
          const raw = (r as { raw_rows?: number }).raw_rows
          const skipped = (r as { files_skipped?: number }).files_skipped
          let msg = `Загружено файлов: ${loaded}${raw != null ? `, сырых строк: ${raw.toLocaleString('ru-RU')}` : ''}`
          if (skipped) msg += `, пропущено: ${skipped}`
          return msg
        },
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
    }
  }

  const handleProcess = async () => {
    setError(null)
    try {
      const msg = await runLoadAction(
        'Обработка и отображение',
        [
          'Чтение сырых данных (raw_import)',
          'Преобразование QWER → таблица A–X',
          'Расчёт сумм: Покупка / Обмен / Возврат+Сбор',
          'Формирование «Маршрут + дата вылета»',
          'Сохранение в processed',
          'Создание снимка обработки',
        ],
        async ({ advance, startElapsedTimer }) => {
          startElapsedTimer('Обработка')
          advance()
          const r = await api.ticketsCostsProcess(registry)
          advance()
          advance()
          advance()
          advance()
          advance()
          await onRefreshStatus(true)
          onDataChanged()
          onOpenTable()
          const rows = (r as { processed_rows?: number }).processed_rows ?? 0
          return `Обработано строк: ${rows.toLocaleString('ru-RU')}`
        },
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка обработки')
    }
  }

  const handleClearRegistry = async () => {
    const label = REGISTRY_LABELS[registry]
    if (
      !confirm(
        `Очистить все данные реестра «${label}»?\n\n` +
          'Будут удалены: сырые данные, таблица processed, снимки обработок и сохранённые исходные файлы.\n\n' +
          'Рекомендуется перейти на вкладку «Загрузить и обработать» перед очисткой.',
      )
    ) {
      return
    }
    setError(null)
    try {
      await runLoadAction(
        `Очистка реестра ${label}`,
        ['Удаление базы SQLite', 'Удаление исходных файлов', 'Сброс метаданных'],
        async ({ advance, startElapsedTimer }) => {
          startElapsedTimer('Очистка')
          advance()
          await api.ticketsCostsClear(registry)
          advance()
          setPendingFiles([])
          setSelectedFileId(null)
          setPreviewRows([])
          setSelectedRunId(null)
          setRunPreviewRows([])
          await onRefreshStatus()
          advance()
          onDataChanged()
          return `Реестр «${label}» очищен`
        },
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка очистки')
    }
  }

  const removePendingFile = (id: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.id !== id))
    void api.ticketsCostsQueueRemove(registry, id).catch(() => {})
  }

  const handleClearStoredFiles = async () => {
    if (!storedFiles.length) return
    const label = REGISTRY_LABELS[registry]
    if (
      !window.confirm(
        `Удалить все ${storedFiles.length} исходных файлов из «${label}»?\n\nОбработанная таблица и сырые данные в реестре не затрагиваются.`,
      )
    ) {
      return
    }
    setError(null)
    try {
      await runLoadAction(
        'Очистка исходных файлов',
        ['Удаление файлов на диске', 'Обновление списка'],
        async ({ advance, startElapsedTimer }) => {
          startElapsedTimer('Очистка')
          advance()
          const r = await api.ticketsCostsClearAllSources(registry)
          advance()
          setSelectedFileId(null)
          setPreviewRows([])
          await onRefreshStatus(true)
          const deleted = (r as { deleted?: number }).deleted ?? 0
          return (r as { message?: string }).message || `Удалено файлов: ${deleted}`
        },
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка очистки файлов')
    }
  }

  const handleDedupe = async (fuzzy: boolean) => {
    setError(null)
    const title = fuzzy ? 'Повтор: Fuzzy по ФИО' : 'Повтор: дедупликация и База'
    const steps = fuzzy
      ? [
          'Загрузка processed',
          `Fuzzy-сопоставление ФИО (порог ${fuzzyFioPercent}%)`,
          'Сохранение в processed',
          'Создание снимка',
        ]
      : [
          'Загрузка processed',
          'Дедупликация по номеру билета',
          'Дополнение: табельный → паспорт → ФИО → fuzzy',
          'Сохранение в processed',
          'Экспорт Excel (при необходимости)',
          'Создание снимка',
        ]
    try {
      const msg = await runLoadAction(
        title,
        steps,
        async ({ advance, startElapsedTimer }) => {
          startElapsedTimer(fuzzy ? 'Fuzzy' : 'Дедупликация')
          advance()
          const r = await api.ticketsCostsDedupeEnrich(registry, {
            fuzzy,
            fuzzyFioCutoff: fuzzyFioPercent,
            runDedupe: !fuzzy,
          })
          advance()
          if (!fuzzy) {
            advance()
            advance()
            advance()
          } else {
            advance()
            advance()
          }
          await onRefreshStatus()
          onDataChanged()
          onOpenTable()
          const rows = (r as { rows?: number }).rows
          const filled = (r as { filled_passport?: number; filled_fuzzy?: number }).filled_fuzzy
            ?? (r as { filled_fio_exact?: number }).filled_fio_exact
          let out = `Готово: ${rows?.toLocaleString('ru-RU') ?? '—'} строк`
          if (filled) out += `, заполнено D/E: ${filled}`
          if ((r as { run_id?: string }).run_id) out += ' • снимок сохранён'
          return out
        },
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    }
  }

  const openFilePreview = async (fileId: string) => {
    setSelectedFileId(fileId)
    setPreviewLoading(true)
    setError(null)
    try {
      const res = await api.ticketsCostsSourcePreview(registry, fileId)
      setPreviewCols((res as { columns?: PreviewCol[] }).columns || [])
      setPreviewRows((res as { data?: Record<string, string>[] }).data || [])
      setPreviewMeta({
        name: (res as { original_name?: string }).original_name || '',
        total: (res as { total_rows?: number }).total_rows ?? 0,
      })
      setPreviewStoredPath((res as { stored_path?: string }).stored_path || null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка предпросмотра')
      setPreviewCols([])
      setPreviewRows([])
    } finally {
      setPreviewLoading(false)
    }
  }

  const openRunPreview = async (runId: string) => {
    setSelectedRunId(runId)
    setRunPreviewLoading(true)
    try {
      const res = await api.ticketsCostsRunData(registry, runId, { limit: 200 })
      const cols = (res as { columns?: { key: string; title: string }[] }).columns || []
      setRunPreviewCols(cols.map((c) => ({ key: c.key, title: c.title })))
      setRunPreviewRows((res as { data?: Record<string, unknown>[] }).data || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка снимка')
    } finally {
      setRunPreviewLoading(false)
    }
  }

  const activateRun = async (runId: string) => {
    setLoading(true)
    try {
      await api.ticketsCostsActivateRun(registry, runId)
      await onRefreshStatus()
      onDataChanged()
      onOpenTable()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка активации')
    } finally {
      setLoading(false)
    }
  }

  const deleteRun = async (runId: string) => {
    if (!confirm('Удалить этот снимок обработки?')) return
    setLoading(true)
    try {
      await api.ticketsCostsDeleteRun(registry, runId)
      await onRefreshStatus()
      if (selectedRunId === runId) {
        setSelectedRunId(null)
        setRunPreviewRows([])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка удаления')
    } finally {
      setLoading(false)
    }
  }

  const deleteStoredFile = async (fileId: string) => {
    if (!confirm('Удалить файл из хранилища программы?')) return
    setLoading(true)
    try {
      await api.ticketsCostsDeleteSourceFile(registry, fileId)
      await onRefreshStatus()
      if (selectedFileId === fileId) {
        setSelectedFileId(null)
        setPreviewRows([])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 p-4 gap-4 overflow-auto">
      {(actionStatusState?.active ||
        actionStatusState?.success ||
        actionStatusState?.error) && (
        <TicketCostsActionStatusBar
          status={actionStatusState}
          onDismiss={() => resetActionStatus()}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept=".xlsx,.xlsm,.xls"
        onChange={(e) => void uploadBrowserFiles(e.target.files)}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-gray-800">Новая загрузка</h3>
          <div
            className={`rounded-lg border-2 border-dashed px-4 py-4 text-center ${
              isDragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-gray-50'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragOver(false)
              void uploadBrowserFiles(e.dataTransfer.files)
            }}
          >
            <p className="text-[11px] text-gray-600">Перетащите Excel или выберите с диска</p>
            <p className="text-[10px] text-gray-400 mt-1">
              1) Файлы в очередь (сохраняются до удаления или «Очистить реестр») → 2) «Загрузить в реестр»
              или 3) «Обработать и отобразить»
            </p>
            {pendingFiles.length > 0 && storedFiles.length === 0 && rawRows === 0 && (
              <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-2">
                В очереди {pendingFiles.length} файл(ов). Сначала нужно загрузить их в реестр — нажмите
                «Загрузить в {REGISTRY_LABELS[registry]}» или «Обработать и отобразить» (сделает всё сам).
              </p>
            )}
            <Button
              size="sm"
              variant="outline"
              className="mt-2 h-8"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
              Выбрать файлы
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <PathInputWithBrowse
              value={folderPath}
              onChange={setFolderPath}
              mode="folder"
              placeholder="Папка на сервере"
              inputClassName="h-8 min-w-[200px] rounded border border-gray-300 px-2 text-xs"
            />
            <input
              value={manualPath}
              onChange={(e) => setManualPath(e.target.value)}
              placeholder="Путь к файлу"
              className="h-8 flex-1 min-w-[160px] rounded border border-gray-300 px-2 text-xs"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => {
                const p = manualPath.trim()
                if (p) addPathsToQueue([{ id: newPendingId(), name: p.split(/[/\\]/).pop() || p, path: p }])
                setManualPath('')
              }}
            >
              В очередь
            </Button>
            <Button size="sm" variant="outline" className="h-8" disabled={busy} onClick={() => void handleScanFolder()}>
              <FolderOpen className="h-3.5 w-3.5 mr-1" />
              Из папки
            </Button>
          </div>
          {pendingFiles.length > 0 && (
            <div className="rounded border border-gray-200 bg-white overflow-hidden">
              <div className="px-2 py-1 bg-gray-50 text-[10px] font-medium text-gray-600 border-b">
                Очередь загрузки ({pendingFiles.length})
              </div>
              <ul className="max-h-28 overflow-y-auto divide-y">
                {pendingFiles.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 px-2 py-1 text-[10px]">
                    <FileSpreadsheet className="h-3 w-3 text-green-600 shrink-0" />
                    <span className="flex-1 truncate" title={f.path}>{f.name}</span>
                    <button
                      type="button"
                      className="text-gray-400 hover:text-red-600 shrink-0"
                      onClick={() => removePendingFile(f.id)}
                      title="Убрать из очереди"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void handleLoad(false)} disabled={busy || !pendingFiles.length}>
              <Upload className="h-3.5 w-3.5 mr-1" />
              Загрузить в {REGISTRY_LABELS[registry]}
            </Button>
            <Button size="sm" variant="outline" onClick={() => void handleLoad(true)} disabled={busy || !pendingFiles.length}>
              Добавить к загруженным
            </Button>
            <Button size="sm" onClick={() => void handleProcess()} disabled={busy}>
              <GitMerge className="h-3.5 w-3.5 mr-1" />
              Обработать и отобразить
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-red-700 border-red-200 hover:bg-red-50"
              disabled={busy}
              onClick={() => void handleClearRegistry()}
            >
              <Eraser className="h-3.5 w-3.5 mr-1" />
              Очистить реестр
            </Button>
          </div>
          <p className="text-[10px] text-gray-500 pt-1 border-t border-gray-100">
            Очистка табельного/паспорта и повторное заполнение из Основной Базы — на вкладке «Таблица данных».
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden flex flex-col min-h-[200px]">
          <div className="px-3 py-2 border-b bg-gray-50 text-[11px] font-semibold text-gray-700 flex items-center gap-2 flex-wrap">
            <span>
              Исходные файлы в программе ({filesListLoading ? '…' : storedFiles.length})
            </span>
            {filesListLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />}
            {storedFiles.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px] ml-auto text-red-700 border-red-200 hover:bg-red-50"
                disabled={busy}
                onClick={() => void handleClearStoredFiles()}
              >
                <Eraser className="h-3 w-3 mr-1" />
                Очистить
              </Button>
            )}
          </div>
          {filesListLoading ? (
            <p className="text-[11px] text-gray-500 p-4 text-center flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Загрузка списка файлов…
            </p>
          ) : storedFiles.length === 0 ? (
            <p className="text-[11px] text-gray-400 p-4 text-center">
              После «Загрузить в реестр» файлы остаются здесь до выборочного удаления или «Очистить реестр»
            </p>
          ) : (
            <ScrollArea className="max-h-40">
              <ul className="divide-y">
                {storedFiles.map((f) => (
                  <li key={f.file_id} className="flex items-center gap-2 px-3 py-1.5 text-[11px]">
                    <button
                      type="button"
                      className={`flex-1 text-left truncate hover:text-indigo-700 ${selectedFileId === f.file_id ? 'font-semibold text-indigo-800' : ''}`}
                      onClick={() => void openFilePreview(f.file_id)}
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5 inline mr-1 text-green-600" />
                      {f.original_name}
                      {f.row_count != null ? ` (${f.row_count.toLocaleString('ru-RU')} стр.)` : ''}
                    </button>
                    <button type="button" className="text-gray-400 hover:text-red-600" onClick={() => void deleteStoredFile(f.file_id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </div>
      </div>

      {(selectedFileId && (previewLoading || previewRows.length > 0)) && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          {previewLoading ? (
            <div className="p-4 flex gap-2 text-gray-500 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Загрузка…
            </div>
          ) : (
            <FilterableDataTable
              title={`Содержимое: ${previewMeta?.name || selectedFileId}${previewMeta ? ` • всего ${previewMeta.total.toLocaleString('ru-RU')} стр.` : ''}`}
              editTitle={previewMeta?.name || 'Исходный файл'}
              columns={previewCols}
              rows={previewRows as Record<string, unknown>[]}
              filePath={previewStoredPath}
              maxHeight="max-h-[40vh]"
              headerVariant="indigo"
            />
          )}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="px-3 py-2 border-b bg-gray-50 text-[11px] font-semibold text-gray-700 flex items-center gap-2">
          История обработок (снимки)
          {historyListLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />}
        </div>
        {historyListLoading ? (
          <p className="text-[11px] text-gray-500 p-4 text-center flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Загрузка истории…
          </p>
        ) : processingRuns.length === 0 ? (
          <p className="text-[11px] text-gray-400 p-4 text-center">Каждая обработка сохраняется отдельным снимком</p>
        ) : (
          <>
            <ScrollArea className="max-h-36">
              <ul className="divide-y text-[11px]">
                {processingRuns.map((run) => (
                  <li
                    key={run.run_id}
                    className={`flex items-center gap-2 px-3 py-2 ${run.active ? 'bg-emerald-50' : ''}`}
                  >
                    <button
                      type="button"
                      className="flex-1 text-left"
                      onClick={() => void openRunPreview(run.run_id)}
                    >
                      <span className="font-medium">{run.label}</span>
                      <span className="text-gray-500 block">
                        {new Date(run.created_at).toLocaleString('ru-RU')} • {run.row_count.toLocaleString('ru-RU')} стр.
                        {run.active ? ' • активный' : ''}
                      </span>
                    </button>
                    <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => void activateRun(run.run_id)}>
                      <Eye className="h-3 w-3 mr-0.5" />
                      Открыть
                    </Button>
                    <button type="button" className="text-gray-400 hover:text-red-600" onClick={() => void deleteRun(run.run_id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </ScrollArea>
            {selectedRunId && (
              <div className="border-t">
                {runPreviewLoading ? (
                  <div className="p-4">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <FilterableDataTable
                    title="Снимок обработки"
                    editTitle={`Снимок ${selectedRunId}`}
                    columns={runPreviewCols}
                    rows={runPreviewRows}
                    maxHeight="max-h-[30vh]"
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">{error}</div>
      )}
    </div>
  )
}
