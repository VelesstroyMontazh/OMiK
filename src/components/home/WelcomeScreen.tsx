'use client'

import React, { useCallback, useRef, useState } from 'react'
import { useExcelStore, type FileInfo } from '@/store/excel-store'
import { useUploadWithVba } from '@/hooks/use-upload-with-vba'
import { Button } from '@/components/ui/button'
import {
  Upload,
  FilePlus,
  FileSpreadsheet,
  Loader2,
  Table2,
  Code2,
  BarChart3,
  Zap,
  Database,
  FileDown,
  Settings,
} from 'lucide-react'
import WelcomeModuleCard from '@/components/home/WelcomeModuleCard'
import WelcomeDateTimePanel from '@/components/home/WelcomeDateTimePanel'
import SettingsDialog from '@/components/settings/SettingsDialog'
import { useWelcomeModules } from '@/hooks/use-welcome-modules'

export function WelcomeScreen() {
  const api = useUploadWithVba()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const files = useExcelStore((s) => s.files)
  const setFiles = useExcelStore((s) => s.setFiles)
  const isUploading = useExcelStore((s) => s.isUploading)
  const [isDragOver, setIsDragOver] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { modules: welcomeModules } = useWelcomeModules()

  const processFile = useCallback(
    async (file: File) => {
      useExcelStore.getState().setIsUploading(true)
      useExcelStore.getState().setUploadProgress(0)

      try {
        const result = await api.uploadFile(file)
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

        if (result.sheets.length > 0) {
          useExcelStore.getState().setIsLoading(true)
          try {
            const sheetResult = await api.fetchSheetData(result.file_path, result.sheets[0])
            const store = useExcelStore.getState()
            const newSheets = result.sheets.map((name, i) => {
              if (i === 0) return { ...store.sheets[0], name }
              return {
                name,
                data: {},
                mergedCells: [],
                columnWidths: {},
                rowHeights: {},
                defaultColumnWidth: 100,
                defaultRowHeight: 24,
              }
            })

            store.pushNavHistory()
            useExcelStore.setState({
              activeFile: newFile,
              currentFilePath: result.file_path,
              sheets: newSheets,
              activeSheetIndex: 0,
              selectedCell: { row: 0, col: 0 },
              selectedRange: null,
            })
            store.loadApiSheetData(sheetResult.data)
          } catch (err) {
            useExcelStore.getState().setError(err instanceof Error ? err.message : 'Ошибка загрузки данных')
          } finally {
            useExcelStore.getState().setIsLoading(false)
          }
        }
      } catch (err) {
        useExcelStore.getState().setError(err instanceof Error ? err.message : 'Ошибка загрузки файла')
      } finally {
        useExcelStore.getState().setIsUploading(false)
        useExcelStore.getState().setUploadProgress(0)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    },
    [api, setFiles],
  )

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleNewClick = useCallback(() => {
    useExcelStore.getState().pushNavHistory()
    useExcelStore.setState({
      activeFile: { id: 'new', name: 'Новая книга', createdAt: Date.now(), updatedAt: Date.now(), size: 0 },
      currentFilePath: null,
      sheets: [{
        name: 'Лист1',
        data: {},
        mergedCells: [],
        columnWidths: {},
        rowHeights: {},
        defaultColumnWidth: 100,
        defaultRowHeight: 24,
      }],
      activeSheetIndex: 0,
      selectedCell: { row: 0, col: 0 },
      selectedRange: null,
    })
  }, [])

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) await processFile(file)
    },
    [processFile],
  )

  const handleRecentFileClick = useCallback(
    async (file: FileInfo) => {
      if (!file.filePath || !file.sheets || file.sheets.length === 0) return

      useExcelStore.getState().setIsLoading(true)
      try {
        const sheetResult = await api.fetchSheetData(file.filePath, file.sheets[0])
        const store = useExcelStore.getState()
        const newSheets = file.sheets.map((name, i) => {
          if (i === 0) return { ...store.sheets[0], name }
          return {
            name,
            data: {},
            mergedCells: [],
            columnWidths: {},
            rowHeights: {},
            defaultColumnWidth: 100,
            defaultRowHeight: 24,
          }
        })

        store.pushNavHistory()
        useExcelStore.setState({
          activeFile: file,
          currentFilePath: file.filePath,
          sheets: newSheets,
          activeSheetIndex: 0,
          selectedCell: { row: 0, col: 0 },
          selectedRange: null,
        })
        store.loadApiSheetData(sheetResult.data)
      } catch (err) {
        useExcelStore.getState().setError(err instanceof Error ? err.message : 'Ошибка загрузки файла')
      } finally {
        useExcelStore.getState().setIsLoading(false)
      }
    },
    [api],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      const file = e.dataTransfer.files[0]
      if (file) await processFile(file)
    },
    [processFile],
  )

  return (
    <div
      className={`flex-1 min-h-0 flex flex-col overflow-hidden transition-colors duration-200 ${isDragOver ? 'bg-green-50' : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".xlsx,.xls,.csv,.xlsb,.xlsm,.tsv"
        onChange={handleFileSelect}
      />

      {isDragOver && (
        <div className="fixed inset-0 z-50 bg-green-500/10 border-4 border-dashed border-green-500 flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-2xl px-12 py-8 shadow-2xl text-center">
            <Upload className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <p className="text-xl font-semibold text-green-700">Перетащите файл сюда</p>
            <p className="text-sm text-green-600 mt-1">.xlsx, .xls, .csv, .xlsb</p>
          </div>
        </div>
      )}

      {/* Верхняя строка фиксирована — вкладки прокручиваются отдельно и не заезжают под шапку */}
      <header className="shrink-0 z-20 border-b border-gray-200 bg-white shadow-sm">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-5 py-2.5 sm:py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-green-600 to-green-800 shadow-md flex items-center justify-center shrink-0">
              <Table2 className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
            </div>
            <div className="min-w-0 text-left">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 leading-tight">
                Отчетность ОМиК ВелесстройМонтаж
              </h1>
              <p className="text-sm sm:text-lg lg:text-xl text-gray-600 mt-1 sm:mt-1.5 leading-snug">
                Отдел мобилизации и координации персонала
              </p>
            </div>
          </div>
          <div className="hidden md:block shrink-0">
            <WelcomeDateTimePanel />
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 pb-10 pt-4">
          <div className="flex justify-center md:hidden mb-4">
            <WelcomeDateTimePanel />
          </div>

          <h2 className="text-sm font-semibold text-gray-600 mb-3">Вкладки</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8 text-left">
            {welcomeModules.map((mod) => (
              <WelcomeModuleCard key={mod.id} mod={mod} />
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
            <Button
              size="lg"
              className="bg-green-700 hover:bg-green-800 text-white shadow-lg shadow-green-700/20 h-12 px-6"
              onClick={handleUploadClick}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <Upload className="h-5 w-5 mr-2" />
              )}
              Загрузить файл
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-6"
              onClick={handleNewClick}
            >
              <FilePlus className="h-5 w-5 mr-2" />
              Создать новый
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-6"
              onClick={() => setSettingsOpen(true)}
              title="Настройки"
            >
              <Settings className="h-5 w-5 mr-2" />
              Настройки
            </Button>
          </div>

          <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
              <Code2 className="h-6 w-6 text-green-600 mx-auto mb-2" />
              <div className="text-xs font-medium text-gray-700">VBA & Python</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Макросы и скрипты</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
              <BarChart3 className="h-6 w-6 text-green-600 mx-auto mb-2" />
              <div className="text-xs font-medium text-gray-700">Анализ данных</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Pandas, Polars, NumPy</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
              <Zap className="h-6 w-6 text-green-600 mx-auto mb-2" />
              <div className="text-xs font-medium text-gray-700">Быстрая обработка</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Большие файлы</div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-gray-400 mb-6">
            <FileDown className="h-4 w-4" />
            <span>Или перетащите файл в это окно</span>
          </div>

          {files.length > 0 && (
            <div className="mt-2 max-w-xl mx-auto lg:mx-0">
              <h3 className="text-sm font-medium text-gray-600 mb-3">Последние файлы</h3>
              <div className="space-y-2">
                {files.slice(0, 5).map((file) => (
                  <button
                    key={file.id}
                    className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl bg-white border border-gray-100 hover:border-green-300 hover:bg-green-50 transition-all text-left shadow-sm hover:shadow"
                    onClick={() => handleRecentFileClick(file)}
                  >
                    <FileSpreadsheet className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-700 truncate">{file.name}</div>
                      <div className="text-xs text-gray-400">
                        {new Date(file.updatedAt).toLocaleDateString('ru-RU')}
                        {file.size && (
                          <span className="ml-2">
                            {file.size > 1024 * 1024
                              ? `${(file.size / (1024 * 1024)).toFixed(1)} МБ`
                              : `${(file.size / 1024).toFixed(1)} КБ`}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-400 flex-wrap">
              <Database className="h-3 w-3" />
              <span>
                pandas • openpyxl • polars • numpy • xlsxwriter • pyexcelerate • xlrd • pyxlsb • xlwt • xlutils • formulas • pycel • xlwings
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
