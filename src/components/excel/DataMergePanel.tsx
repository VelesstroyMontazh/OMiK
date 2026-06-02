'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useExcelApi } from '@/hooks/use-excel-api'
import { useUploadWithVba } from '@/hooks/use-upload-with-vba'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Eye, FolderOpen, Loader2, Upload, Combine, CheckCircle2 } from 'lucide-react'
import PathInputWithBrowse from '@/components/excel/PathInputWithBrowse'

type MergeMode = 'headers_equal' | 'headers_equal_select' | 'headers_not_equal'

interface MergeSourceFile {
  id: string
  name: string
  file_path: string
  sheets: string[]
  file_size?: number
}

interface MergeItemConfig extends MergeSourceFile {
  sheet_name: string
  header_row: number
  include: boolean
}

function itemKey(item: { file_path: string; sheet_name: string }): string {
  return `${item.file_path}::${item.sheet_name}`
}

function toCellMatrix(
  data: Array<Array<{ row: number; col: number; value: unknown }>>,
  maxRows = 40,
  maxCols = 30
): string[][] {
  const rows = data.slice(0, maxRows)
  return rows.map((r) =>
    r
      .slice(0, maxCols)
      .sort((a, b) => a.col - b.col)
      .map((c) => (c.value === null || c.value === undefined ? '' : String(c.value)))
  )
}

export default function DataMergePanel() {
  const api = useExcelApi()
  const { uploadFile } = useUploadWithVba()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [sourceType, setSourceType] = useState<'uploaded' | 'folder'>('uploaded')
  const [uploadedFiles, setUploadedFiles] = useState<MergeSourceFile[]>([])
  const [folderPath, setFolderPath] = useState('')
  const [folderFiles, setFolderFiles] = useState<MergeSourceFile[]>([])
  const [folderCount, setFolderCount] = useState(0)
  const [loadingFiles, setLoadingFiles] = useState(false)

  const [items, setItems] = useState<MergeItemConfig[]>([])
  const [previewItemId, setPreviewItemId] = useState<string | null>(null)
  const [previewGrid, setPreviewGrid] = useState<string[][]>([])
  const [loadingPreview, setLoadingPreview] = useState(false)

  const [mode, setMode] = useState<MergeMode>('headers_equal')
  const [selectedHeaders, setSelectedHeaders] = useState<string[]>([])
  const [targetMode, setTargetMode] = useState<'manual' | 'from_file'>('manual')
  const [targetHeaderInput, setTargetHeaderInput] = useState('')
  const [targetHeaders, setTargetHeaders] = useState<string[]>([])
  const [headerOptionsByItem, setHeaderOptionsByItem] = useState<Record<string, string[]>>({})
  const [mappings, setMappings] = useState<Record<string, Record<string, string>>>({})

  const [outputName, setOutputName] = useState('merged_result.xlsx')
  const [merging, setMerging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{
    file_id: string
    stored_filename: string
    rows: number
    columns: number
    source_files: number
  } | null>(null)

  const activeSources = sourceType === 'uploaded' ? uploadedFiles : folderFiles
  const includedItems = items.filter((i) => i.include)

  const unifiedHeaderOptions = useMemo(() => {
    if (!previewItemId) return []
    return headerOptionsByItem[previewItemId] || []
  }, [headerOptionsByItem, previewItemId])

  const refreshUploadedFiles = useCallback(async () => {
    setLoadingFiles(true)
    try {
      const result = await api.fetchFiles()
      const mapped = (result.files || []).map((f) => ({
        id: f.file_id,
        name: f.stored_filename,
        file_path: f.file_path,
        sheets: f.sheets || [],
        file_size: f.file_size,
      }))
      setUploadedFiles(mapped)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки списка файлов')
    } finally {
      setLoadingFiles(false)
    }
  }, [api])

  useEffect(() => {
    refreshUploadedFiles()
  }, [refreshUploadedFiles])

  useEffect(() => {
    const mapped = activeSources.map((f) => ({
      ...f,
      sheet_name: f.sheets[0] || 'Sheet1',
      header_row: 1,
      include: true,
    }))
    setItems(mapped)
    setPreviewItemId(mapped[0]?.id || null)
    setHeaderOptionsByItem({})
    setMappings({})
    setSelectedHeaders([])
    setTargetHeaders([])
  }, [activeSources])

  const loadHeaderOptions = useCallback(
    async (item: MergeItemConfig) => {
      try {
        const range = `A${item.header_row}:AZ${item.header_row}`
        const result = await api.fetchSheetData(item.file_path, item.sheet_name, range)
        const row = result.data[0] || []
        const headers = row
          .sort((a, b) => a.col - b.col)
          .map((c) => (c.value === null || c.value === undefined ? '' : String(c.value).trim()))
          .filter((v) => v !== '')
        const key = item.id
        setHeaderOptionsByItem((prev) => ({ ...prev, [key]: headers }))
      } catch {
        // do not fail the whole screen for one bad sheet
      }
    },
    [api]
  )

  useEffect(() => {
    items.forEach((item) => {
      void loadHeaderOptions(item)
    })
  }, [items, loadHeaderOptions])

  const handleUploadFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return
      setError(null)
      setSuccess(null)
      for (const file of Array.from(files)) {
        try {
          await uploadFile(file)
        } catch (e) {
          setError(`Ошибка загрузки "${file.name}": ${e instanceof Error ? e.message : 'unknown'}`)
          break
        }
      }
      await refreshUploadedFiles()
      setSourceType('uploaded')
    },
    [uploadFile, refreshUploadedFiles]
  )

  const handleScanFolder = useCallback(async () => {
    setError(null)
    setSuccess(null)
    if (!folderPath.trim()) {
      setError('Укажите путь к папке с Excel-файлами')
      return
    }
    setLoadingFiles(true)
    try {
      const result = await api.scanMergeFolder(folderPath.trim())
      const files = (result.files || []).map((f: MergeSourceFile, idx: number) => ({
        id: `folder-${idx}-${f.file_path}`,
        name: f.name,
        file_path: f.file_path,
        sheets: f.sheets || [],
        file_size: f.file_size,
      }))
      setFolderFiles(files)
      setFolderCount(result.count || files.length)
      setSourceType('folder')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сканирования папки')
    } finally {
      setLoadingFiles(false)
    }
  }, [api, folderPath])

  const handlePreview = useCallback(
    async (item: MergeItemConfig) => {
      setPreviewItemId(item.id)
      setLoadingPreview(true)
      try {
        const result = await api.fetchSheetData(item.file_path, item.sheet_name, `A1:AZ80`)
        setPreviewGrid(toCellMatrix(result.data || []))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка предпросмотра листа')
        setPreviewGrid([])
      } finally {
        setLoadingPreview(false)
      }
    },
    [api]
  )

  const updateItem = useCallback((id: string, patch: Partial<MergeItemConfig>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }, [])

  const handleAddTargetHeader = useCallback(() => {
    const v = targetHeaderInput.trim()
    if (!v) return
    if (!targetHeaders.includes(v)) {
      setTargetHeaders((prev) => [...prev, v])
    }
    setTargetHeaderInput('')
  }, [targetHeaderInput, targetHeaders])

  const handleMerge = useCallback(async () => {
    setError(null)
    setSuccess(null)
    if (includedItems.length === 0) {
      setError('Выберите минимум один файл/лист для объединения')
      return
    }
    if (mode === 'headers_equal_select' && selectedHeaders.length === 0) {
      setError('Выберите заголовки для объединения')
      return
    }
    if (mode === 'headers_not_equal' && targetHeaders.length === 0) {
      setError('Укажите целевые заголовки')
      return
    }

    setMerging(true)
    try {
      const payload = {
        mode,
        items: includedItems.map((it) => ({
          file_path: it.file_path,
          sheet_name: it.sheet_name,
          header_row: it.header_row,
          include: it.include,
        })),
        selected_headers: mode === 'headers_equal_select' ? selectedHeaders : undefined,
        target_headers: mode === 'headers_not_equal' ? targetHeaders : undefined,
        mappings: mode === 'headers_not_equal' ? mappings : undefined,
        output_name: outputName,
      }
      const result = await api.executeMerge(payload)
      setSuccess({
        file_id: result.file_id,
        stored_filename: result.stored_filename,
        rows: result.rows,
        columns: result.columns,
        source_files: result.source_files,
      })
      await refreshUploadedFiles()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка объединения')
    } finally {
      setMerging(false)
    }
  }, [api, includedItems, mappings, mode, outputName, refreshUploadedFiles, selectedHeaders, targetHeaders])

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white">
      <div className="border-b border-gray-200 px-4 py-3 flex items-center gap-3 bg-gray-50">
        <h2 className="text-sm font-bold text-gray-800">Объединение данных</h2>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".xlsx,.xls,.xlsb,.xlsm,.csv,.tsv"
          multiple
          onChange={(e) => void handleUploadFiles(e.target.files)}
        />
        <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-3.5 w-3.5 mr-1.5" />
          Загрузить файлы
        </Button>
        <div className="flex items-center gap-2 ml-2">
          <PathInputWithBrowse
            value={folderPath}
            onChange={setFolderPath}
            mode="folder"
            placeholder="Путь к папке с Excel"
            className="flex items-center gap-2"
            inputClassName="h-8 w-[320px] rounded border border-gray-300 px-2 text-xs"
          />
          <Button size="sm" variant="outline" onClick={handleScanFolder} disabled={loadingFiles}>
            {loadingFiles ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <FolderOpen className="h-3.5 w-3.5 mr-1" />}
            Сканировать папку
          </Button>
        </div>
        <div className="ml-auto text-xs text-gray-500">
          В папке: <span className="font-semibold text-gray-700">{folderCount}</span> файлов
        </div>
      </div>

      <div className="border-b border-gray-200 px-4 py-2 flex items-center gap-3 bg-white">
        <label className="text-xs text-gray-600">Режим:</label>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as MergeMode)}
          className="h-8 rounded border border-gray-300 px-2 text-xs"
        >
          <option value="headers_equal">1) Заголовки равны</option>
          <option value="headers_equal_select">2) Заголовки равны, выбрать</option>
          <option value="headers_not_equal">3) Заголовки не совпадают</option>
        </select>
        <input
          value={outputName}
          onChange={(e) => setOutputName(e.target.value)}
          placeholder="Имя выходного файла"
          className="h-8 w-[260px] rounded border border-gray-300 px-2 text-xs"
        />
        <Button size="sm" onClick={handleMerge} disabled={merging}>
          {merging ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Combine className="h-3.5 w-3.5 mr-1.5" />}
          Начать объединение
        </Button>
      </div>

      {error && <div className="px-4 py-2 text-xs text-red-700 bg-red-50 border-b border-red-200">{error}</div>}
      {success && (
        <div className="px-4 py-2 text-xs text-emerald-700 bg-emerald-50 border-b border-emerald-200 flex items-center gap-3">
          <CheckCircle2 className="h-4 w-4" />
          <span>
            Готово: {success.stored_filename} • строк: {success.rows.toLocaleString('ru-RU')} • столбцов: {success.columns} • источников: {success.source_files}
          </span>
          <Button size="sm" variant="outline" className="h-7 ml-auto" onClick={() => void api.downloadFile(success.file_id)}>
            Скачать результат
          </Button>
        </div>
      )}

      <div className="flex-1 min-h-0 flex">
        <div className="w-[420px] border-r border-gray-200 flex flex-col min-h-0">
          <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-200">
            Источники ({items.length})
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-2">
              {items.map((item) => (
                <div key={item.id} className="rounded border border-gray-200 bg-white p-2 space-y-2">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={item.include}
                      onChange={(e) => updateItem(item.id, { include: e.target.checked })}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-800 truncate" title={item.name}>{item.name}</div>
                      <div className="text-[10px] text-gray-500 truncate">{item.file_path}</div>
                    </div>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => void handlePreview(item)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={item.sheet_name}
                      onChange={(e) => updateItem(item.id, { sheet_name: e.target.value })}
                      className="h-7 rounded border border-gray-300 px-1 text-[11px]"
                    >
                      {item.sheets.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <select
                      value={String(item.header_row)}
                      onChange={(e) => updateItem(item.id, { header_row: Number(e.target.value) })}
                      className="h-7 rounded border border-gray-300 px-1 text-[11px]"
                    >
                      {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>Строка заголовков: {n}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          <div className="p-3 border-b border-gray-200 bg-white space-y-3">
            {mode === 'headers_equal_select' && (
              <div>
                <div className="text-xs font-semibold text-gray-700 mb-1">Выберите заголовки для объединения</div>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {unifiedHeaderOptions.map((h) => (
                    <label key={h} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-gray-200">
                      <input
                        type="checkbox"
                        checked={selectedHeaders.includes(h)}
                        onChange={(e) => {
                          setSelectedHeaders((prev) =>
                            e.target.checked ? [...prev, h] : prev.filter((x) => x !== h)
                          )
                        }}
                      />
                      {h}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {mode === 'headers_not_equal' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="text-xs font-semibold text-gray-700">Целевые заголовки:</div>
                  <select
                    value={targetMode}
                    onChange={(e) => setTargetMode(e.target.value as 'manual' | 'from_file')}
                    className="h-7 rounded border border-gray-300 px-2 text-xs"
                  >
                    <option value="manual">Указать вручную</option>
                    <option value="from_file">Выбрать из файла</option>
                  </select>
                </div>

                {targetMode === 'manual' ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={targetHeaderInput}
                      onChange={(e) => setTargetHeaderInput(e.target.value)}
                      className="h-8 w-[280px] rounded border border-gray-300 px-2 text-xs"
                      placeholder="Новый целевой заголовок"
                    />
                    <Button size="sm" variant="outline" onClick={handleAddTargetHeader}>Добавить</Button>
                  </div>
                ) : (
                  <div className="text-[11px] text-gray-600">
                    Выберите файл слева, нажмите <Eye className="inline h-3 w-3" /> и нажмите на название заголовка в предпросмотре.
                  </div>
                )}

                <div className="flex flex-wrap gap-1">
                  {targetHeaders.map((h) => (
                    <button
                      key={h}
                      className="px-2 py-1 text-[11px] rounded border border-blue-200 bg-blue-50 text-blue-700"
                      onClick={() => setTargetHeaders((prev) => prev.filter((x) => x !== h))}
                    >
                      {h} ×
                    </button>
                  ))}
                </div>

                {targetHeaders.length > 0 && (
                  <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded p-2">
                    {includedItems.map((item) => {
                      const key = itemKey(item)
                      const headers = headerOptionsByItem[item.id] || []
                      return (
                        <div key={key} className="border border-gray-100 rounded p-2">
                          <div className="text-[11px] font-medium text-gray-700 mb-2">{item.name} / {item.sheet_name}</div>
                          <div className="grid grid-cols-2 gap-2">
                            {targetHeaders.map((target) => (
                              <React.Fragment key={`${key}-${target}`}>
                                <div className="text-[11px] text-gray-600">{target}</div>
                                <select
                                  value={mappings[key]?.[target] || ''}
                                  onChange={(e) =>
                                    setMappings((prev) => ({
                                      ...prev,
                                      [key]: {
                                        ...(prev[key] || {}),
                                        [target]: e.target.value,
                                      },
                                    }))
                                  }
                                  className="h-7 rounded border border-gray-300 px-1 text-[11px]"
                                >
                                  <option value="">-- пусто --</option>
                                  {headers.map((h) => (
                                    <option key={h} value={h}>{h}</option>
                                  ))}
                                </select>
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-auto p-3 bg-gray-50">
            <div className="text-xs text-gray-500 mb-2">Предпросмотр листа (правый блок, кнопка «глаз» в списке слева)</div>
            {loadingPreview ? (
              <div className="py-8 text-center text-sm text-gray-500">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                Загрузка предпросмотра...
              </div>
            ) : previewGrid.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">Нет данных для предпросмотра</div>
            ) : (
              <table className="text-[11px] border-collapse bg-white border border-gray-200">
                <tbody>
                  {previewGrid.map((row, rIdx) => (
                    <tr key={rIdx}>
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className={`border border-gray-100 px-2 py-1 whitespace-nowrap ${
                            rIdx + 1 === (items.find((i) => i.id === previewItemId)?.header_row || -1)
                              ? 'bg-cyan-50 cursor-pointer hover:bg-cyan-100'
                              : ''
                          }`}
                          onClick={() => {
                            if (
                              mode === 'headers_not_equal' &&
                              targetMode === 'from_file' &&
                              rIdx + 1 === (items.find((i) => i.id === previewItemId)?.header_row || -1)
                            ) {
                              const v = cell.trim()
                              if (v && !targetHeaders.includes(v)) {
                                setTargetHeaders((prev) => [...prev, v])
                              }
                            }
                          }}
                          title={cell}
                        >
                          {cell || ' '}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
