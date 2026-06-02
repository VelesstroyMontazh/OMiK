'use client'

import React, { useCallback, useRef, useState } from 'react'
import { useExcelStore, type FileInfo } from '@/store/excel-store'
import { useExcelApi } from '@/hooks/use-excel-api'
import { useUploadWithVba } from '@/hooks/use-upload-with-vba'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileIcon, Code2, BarChart3, X, FileSpreadsheet, Clock, Upload, Trash2, Download, Loader2, Users, GitMerge, Plane, Wand2, Route, Ticket } from 'lucide-react'
import { Button } from '@/components/ui/button'

function FilesPanel() {
  const { files, activeFile, setIsLoading, setError, setFiles } = useExcelStore()
  const api = useUploadWithVba()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const loadFileData = useCallback(
    async (file: FileInfo) => {
      if (!file.filePath || !file.sheets || file.sheets.length === 0) return

      setIsLoading(true)
      setError(null)

      try {
        const sheetName = file.sheets[0]
        const result = await api.fetchSheetData(file.filePath, sheetName)

        // Update the store with sheet names and data
        const store = useExcelStore.getState()
        const newSheets = result.data.length > 0 ? file.sheets!.map((name, i) => {
          if (i === 0) {
            return { ...store.sheets[0], name }
          }
          return { name, data: {}, mergedCells: [], columnWidths: {}, rowHeights: {}, defaultColumnWidth: 100, defaultRowHeight: 24 }
        }) : store.sheets

        store.pushNavHistory()
        useExcelStore.setState({
          activeFile: file,
          currentFilePath: file.filePath,
          sheets: newSheets,
          activeSheetIndex: 0,
          selectedCell: { row: 0, col: 0 },
          selectedRange: null,
        })

        // Load the data
        store.loadApiSheetData(result.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки данных файла')
      } finally {
        setIsLoading(false)
      }
    },
    [api, setIsLoading, setError]
  )

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      useExcelStore.getState().setIsUploading(true)
      useExcelStore.getState().setUploadProgress(0)

      try {
        // Simulate progress
        const progressInterval = setInterval(() => {
          const current = useExcelStore.getState().uploadProgress
          if (current < 90) {
            useExcelStore.getState().setUploadProgress(current + 10)
          }
        }, 200)

        const result = await api.uploadFile(file)

        clearInterval(progressInterval)
        useExcelStore.getState().setUploadProgress(100)

        // Add file to store
        const newFile: FileInfo = {
          id: result.file_id,
          name: result.original_filename,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          size: result.file_size,
          filePath: result.file_path,
          sheets: result.sheets,
          extension: result.extension,
        }

        const currentFiles = useExcelStore.getState().files
        setFiles([newFile, ...currentFiles])

        // Auto-load the file
        await loadFileData(newFile)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки файла')
      } finally {
        useExcelStore.getState().setIsUploading(false)
        useExcelStore.getState().setUploadProgress(0)
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    },
    // loadFileData declared below; stable via useCallback
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadFileData
    [api, setFiles, setError, loadFileData]
  )

  const handleFileClick = useCallback(
    (file: FileInfo) => {
      loadFileData(file)
    },
    [loadFileData]
  )

  const handleDeleteFile = useCallback(
    async (e: React.MouseEvent, fileId: string) => {
      e.stopPropagation()
      try {
        await api.deleteFile(fileId)
        const currentFiles = useExcelStore.getState().files
        setFiles(currentFiles.filter((f) => f.id !== fileId))

        // If deleting active file, reset
        if (useExcelStore.getState().activeFile?.id === fileId) {
          useExcelStore.getState().resetToEmpty()
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка удаления файла')
      }
    },
    [api, setFiles, setError, loadFileData]
  )

  const handleDownloadFile = useCallback(
    async (e: React.MouseEvent, fileId: string) => {
      e.stopPropagation()
      try {
        await api.downloadFile(fileId)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка скачивания файла')
      }
    },
    [api, setError]
  )

  const isUploading = useExcelStore((s) => s.isUploading)
  const uploadProgress = useExcelStore((s) => s.uploadProgress)

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-200 space-y-2">
        <h3 className="text-sm font-medium text-gray-700">Файлы</h3>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".xlsx,.xls,.csv,.xlsb,.xlsm,.tsv"
          onChange={handleFileSelect}
        />
        {/* Main Database button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs border-sky-300 bg-sky-50 hover:bg-sky-100 text-sky-800"
          onClick={() => {
            useExcelStore.getState().navigateTo({
              id: 'calendar-module',
              name: 'Календарь Прилет-Вылет',
              createdAt: Date.now(),
              updatedAt: Date.now(),
              size: 0,
            })
            useExcelStore.getState().setSidebarOpen(false)
          }}
        >
          <Plane className="h-3.5 w-3.5 mr-1.5" />
          Календарь Прилет-Вылет
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs border-sky-300 bg-sky-50 hover:bg-sky-100 text-sky-800"
          onClick={() => {
            useExcelStore.getState().navigateTo({
              id: 'calendar-module',
              name: 'Календарь Прилет-Вылет',
              createdAt: Date.now(),
              updatedAt: Date.now(),
              size: 0,
            })
            useExcelStore.getState().setSidebarOpen(false)
          }}
        >
          <Plane className="h-3.5 w-3.5 mr-1.5" />
          Календарь Прилет-Вылет
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800"
          onClick={() => {
            useExcelStore.getState().navigateTo({
              id: 'main-db',
              name: 'Основная БД — Сотрудники',
              createdAt: Date.now(),
              updatedAt: Date.now(),
              size: 19539715,
            })
            useExcelStore.getState().setSidebarOpen(false)
          }}
        >
          <Users className="h-3.5 w-3.5 mr-1.5" />
          Основная БД
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800"
          onClick={() => {
            useExcelStore.getState().navigateTo({
              id: 'data-merge',
              name: 'Объединение данных',
              createdAt: Date.now(),
              updatedAt: Date.now(),
              size: 0,
            })
            useExcelStore.getState().setSidebarOpen(false)
          }}
        >
          <GitMerge className="h-3.5 w-3.5 mr-1.5" />
          Объединение данных
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs border-sky-300 bg-sky-50 hover:bg-sky-100 text-sky-800"
          onClick={() => {
            useExcelStore.getState().navigateTo({
              id: 'calendar-module',
              name: 'Календарь Прилет–Вылет',
              createdAt: Date.now(),
              updatedAt: Date.now(),
              size: 0,
            })
            useExcelStore.getState().setSidebarOpen(false)
          }}
        >
          <Plane className="h-3.5 w-3.5 mr-1.5" />
          Календарь
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs"
          onClick={handleUploadClick}
          disabled={isUploading}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              {uploadProgress}%
            </>
          ) : (
            <>
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Загрузить файл
            </>
          )}
        </Button>
      </div>
      <ScrollArea className="flex-1">
        {files.length === 0 ? (
          <div className="p-4 text-sm text-gray-500 text-center">
            <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p>Нет загруженных файлов</p>
            <p className="text-xs mt-1">Загрузите Excel файл для начала работы</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {files.map((file) => (
              <div
                key={file.id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer hover:bg-gray-100 group ${
                  activeFile?.id === file.id ? 'bg-green-50 text-green-800' : 'text-gray-700'
                }`}
                onClick={() => handleFileClick(file)}
              >
                <FileSpreadsheet className="h-4 w-4 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="truncate">{file.name}</div>
                  <div className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(file.updatedAt).toLocaleDateString('ru-RU')}
                    {file.size && (
                      <span className="ml-1">
                        ({file.size > 1024 * 1024
                          ? `${(file.size / (1024 * 1024)).toFixed(1)} МБ`
                          : `${(file.size / 1024).toFixed(1)} КБ`})
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-blue-600"
                    onClick={(e) => handleDownloadFile(e, file.id)}
                    title="Экспорт в Excel"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-red-600"
                    onClick={(e) => handleDeleteFile(e, file.id)}
                    title="Удалить"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

function MacrosPanel() {
  const { macros, setMacroEditorOpen } = useExcelStore()

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Макросы</h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs"
          onClick={() => setMacroEditorOpen(true)}
        >
          + Новый
        </Button>
      </div>
      <ScrollArea className="flex-1">
        {macros.length === 0 ? (
          <div className="p-4 text-sm text-gray-500 text-center">
            <Code2 className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p>Нет макросов</p>
            <p className="text-xs mt-1">Создайте макрос для автоматизации</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {macros.map((macro) => (
              <div
                key={macro.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer hover:bg-gray-100 text-gray-700"
                onClick={() => setMacroEditorOpen(true)}
              >
                <Code2 className="h-4 w-4 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="truncate">{macro.name}</div>
                  <div className="text-xs text-gray-400">{macro.language.toUpperCase()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

function AnalysisPanel() {
  const { activeFile, currentFilePath } = useExcelStore()
  const api = useExcelApi()
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<Record<string, Record<string, unknown>> | null>(null)

  const handleAnalyze = useCallback(
    async (operations: string[]) => {
      if (!currentFilePath || !activeFile) return

      setAnalyzing(true)
      try {
        const result = await api.analyzeData(
          currentFilePath,
          activeFile.name || 'Sheet1',
          'A1:Z1000',
          operations
        )
        setAnalysisResult(result.analysis)
      } catch {
        setAnalysisResult(null)
      } finally {
        setAnalyzing(false)
      }
    },
    [api, currentFilePath, activeFile]
  )

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-700">Анализ данных</h3>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 text-sm text-gray-500">
          {!activeFile ? (
            <>
              <BarChart3 className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-center">Загрузите файл для анализа</p>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-center text-gray-600 mb-3">
                Файл: {activeFile.name}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                disabled={analyzing}
                onClick={() => handleAnalyze(['sum', 'avg', 'count', 'min', 'max'])}
              >
                {analyzing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <BarChart3 className="h-3 w-3 mr-1" />}
                Статистика
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                disabled={analyzing}
                onClick={() => handleAnalyze(['describe'])}
              >
                Описание данных
              </Button>

              {analysisResult && (
                <div className="mt-3 p-2 bg-gray-50 rounded text-xs space-y-1 max-h-60 overflow-y-auto">
                  {Object.entries(analysisResult).map(([op, cols]) => (
                    <div key={op}>
                      <div className="font-medium text-gray-700">{op}:</div>
                      {typeof cols === 'object' && cols !== null ? (
                        Object.entries(cols).map(([col, val]) => (
                          <div key={col} className="pl-2 text-gray-600">
                            {col}: {typeof val === 'number' ? val.toFixed(2) : String(val ?? '—')}
                          </div>
                        ))
                      ) : (
                        <div className="pl-2 text-gray-600">{String(cols ?? '—')}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

export default function Sidebar() {
  const { sidebarOpen, sidebarTab, setSidebarOpen, setSidebarTab, isLoading } = useExcelStore()

  if (!sidebarOpen) return null

  return (
    <div className="flex flex-col w-56 border-r border-gray-200 bg-gray-50 flex-shrink-0 relative">
      {/* Close button */}
      <button
        className="absolute top-1 right-1 p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 z-10"
        onClick={() => setSidebarOpen(false)}
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <Tabs
        value={sidebarTab}
        onValueChange={(v) => setSidebarTab(v as 'files' | 'macros' | 'analysis')}
        className="flex flex-col h-full"
      >
        <TabsList className="w-full rounded-none border-b border-gray-200 bg-transparent h-auto p-0">
          <TabsTrigger
            value="files"
            className="flex-1 rounded-none data-[state=active]:bg-white data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-green-600 py-2 text-xs"
          >
            <FileIcon className="h-3.5 w-3.5 mr-1" />
            Файлы
          </TabsTrigger>
          <TabsTrigger
            value="macros"
            className="flex-1 rounded-none data-[state=active]:bg-white data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-green-600 py-2 text-xs"
          >
            <Code2 className="h-3.5 w-3.5 mr-1" />
            Макросы
          </TabsTrigger>
          <TabsTrigger
            value="analysis"
            className="flex-1 rounded-none data-[state=active]:bg-white data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-green-600 py-2 text-xs"
          >
            <BarChart3 className="h-3.5 w-3.5 mr-1" />
            Анализ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="flex-1 m-0">
          <FilesPanel />
        </TabsContent>
        <TabsContent value="macros" className="flex-1 m-0">
          <MacrosPanel />
        </TabsContent>
        <TabsContent value="analysis" className="flex-1 m-0">
          <AnalysisPanel />
        </TabsContent>
      </Tabs>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-20">
          <Loader2 className="h-6 w-6 animate-spin text-green-600" />
        </div>
      )}
    </div>
  )
}
