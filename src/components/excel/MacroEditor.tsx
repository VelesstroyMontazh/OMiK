'use client'

import React, { useCallback, useState } from 'react'
import { useExcelStore } from '@/store/excel-store'
import { useExcelApi } from '@/hooks/use-excel-api'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Play, Save, X, Plus, Trash2, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

export default function MacroEditor() {
  const { macroEditorOpen, setMacroEditorOpen, macros, addMacro, updateMacro, deleteMacro, currentFilePath, activeFile } = useExcelStore()
  const api = useExcelApi()
  const [selectedMacroId, setSelectedMacroId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [language, setLanguage] = useState<'vba' | 'python'>('python')
  const [output, setOutput] = useState<string[]>([])
  const [name, setName] = useState('Макрос1')
  const [isRunning, setIsRunning] = useState(false)
  const [runSuccess, setRunSuccess] = useState<boolean | null>(null)

  const handleNewMacro = useCallback(() => {
    const id = `macro-${Date.now()}`
    const newMacro = {
      id,
      name: `Макрос${macros.length + 1}`,
      language: 'python' as const,
      code: '# Новый макрос Python\n# Доступны: wb (workbook), ws (worksheet), pd (pandas), np (numpy)\n\ndef main():\n    print("Привет, мир!")\n    print(f"Лист: {ws.title}")\n    print(f"Строк: {ws.max_row}, Столбцов: {ws.max_column}")\n\nmain()\n',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    addMacro(newMacro)
    setSelectedMacroId(id)
    setCode(newMacro.code)
    setLanguage(newMacro.language)
    setName(newMacro.name)
    setOutput([])
    setRunSuccess(null)
  }, [macros.length, addMacro])

  const handleSelectMacro = useCallback(
    (id: string) => {
      const macro = macros.find((m) => m.id === id)
      if (macro) {
        setSelectedMacroId(id)
        setCode(macro.code)
        setLanguage(macro.language)
        setName(macro.name)
        setOutput([])
        setRunSuccess(null)
      }
    },
    [macros]
  )

  const handleSave = useCallback(() => {
    if (selectedMacroId) {
      updateMacro(selectedMacroId, { code, language, name })
    } else {
      handleNewMacro()
    }
  }, [selectedMacroId, code, language, name, updateMacro, handleNewMacro])

  const handleRun = useCallback(async () => {
    if (!currentFilePath) {
      setOutput([`[${new Date().toLocaleTimeString('ru-RU')}] ⚠ Ошибка: Файл не загружен. Загрузите файл для выполнения макроса.`])
      setRunSuccess(false)
      return
    }

    setIsRunning(true)
    setRunSuccess(null)
    const langLabel = language.toUpperCase()
    setOutput([`[${new Date().toLocaleTimeString('ru-RU')}] Запуск макроса "${name}" (${langLabel})...`])

    try {
      const result = await api.executeMacro(currentFilePath, code, language)

      if (result.success) {
        setOutput((prev) => [
          ...prev,
          ...(result.output.length > 0
            ? result.output.map((line) => `[${new Date().toLocaleTimeString('ru-RU')}] ✅ ${line}`)
            : [`[${new Date().toLocaleTimeString('ru-RU')}] ✅ Макрос выполнен успешно`]
          ),
        ])
        setRunSuccess(true)

        // Reload sheet data after macro execution since the file may have been modified
        if (activeFile?.filePath && activeFile?.sheets && activeFile.sheets.length > 0) {
          try {
            const store = useExcelStore.getState()
            const sheetName = activeFile.sheets[store.activeSheetIndex] || activeFile.sheets[0]
            const sheetResult = await api.fetchSheetData(activeFile.filePath, sheetName)
            store.loadApiSheetData(sheetResult.data)
            setOutput((prev) => [
              ...prev,
              `[${new Date().toLocaleTimeString('ru-RU')}] 🔄 Данные обновлены`,
            ])
          } catch {
            // Silently fail on reload
          }
        }
      } else {
        setOutput((prev) => [
          ...prev,
          ...(result.errors.length > 0
            ? result.errors.map((err) => `[${new Date().toLocaleTimeString('ru-RU')}] ❌ ${err}`)
            : [`[${new Date().toLocaleTimeString('ru-RU')}] ❌ Макрос завершён с ошибкой`]
          ),
        ])
        setRunSuccess(false)
      }
    } catch (err) {
      setOutput((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString('ru-RU')}] ❌ ${err instanceof Error ? err.message : 'Ошибка выполнения макроса'}`,
      ])
      setRunSuccess(false)
    } finally {
      setIsRunning(false)
    }
  }, [name, language, code, currentFilePath, activeFile, api])

  const handleDeleteMacro = useCallback(() => {
    if (selectedMacroId) {
      deleteMacro(selectedMacroId)
      setSelectedMacroId(null)
      setCode('')
      setName('Макрос1')
      setOutput([])
      setRunSuccess(null)
    }
  }, [selectedMacroId, deleteMacro])

  if (!macroEditorOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-lg shadow-xl w-[800px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-800">Редактор макросов</h2>
            {runSuccess === true && <CheckCircle2 className="h-4 w-4 text-green-500" />}
            {runSuccess === false && <AlertCircle className="h-4 w-4 text-red-500" />}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-green-700 hover:text-green-800 hover:bg-green-50"
              onClick={handleRun}
              disabled={isRunning}
            >
              {isRunning ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5 mr-1" />
              )}
              Запуск
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleSave}>
              <Save className="h-3.5 w-3.5 mr-1" />
              Сохранить
            </Button>
            <button
              className="p-1 rounded hover:bg-gray-100 text-gray-500"
              onClick={() => setMacroEditorOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Macro list */}
          <div className="w-48 border-r border-gray-200 flex flex-col">
            <div className="p-2 border-b border-gray-100">
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs"
                onClick={handleNewMacro}
              >
                <Plus className="h-3 w-3 mr-1" />
                Новый макрос
              </Button>
            </div>
            <ScrollArea className="flex-1">
              {macros.map((macro) => (
                <div
                  key={macro.id}
                  className={`px-3 py-2 text-xs cursor-pointer border-b border-gray-50 ${
                    selectedMacroId === macro.id
                      ? 'bg-green-50 text-green-800 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                  onClick={() => handleSelectMacro(macro.id)}
                >
                  <div className="truncate">{macro.name}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{macro.language.toUpperCase()}</div>
                </div>
              ))}
            </ScrollArea>
          </div>

          {/* Editor area */}
          <div className="flex-1 flex flex-col">
            {/* Editor toolbar */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
              <input
                className="flex-1 text-xs outline-none bg-transparent border border-gray-200 rounded px-2 py-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Имя макроса"
              />
              <Select value={language} onValueChange={(v) => setLanguage(v as 'vba' | 'python')}>
                <SelectTrigger className="h-7 w-[100px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="python">Python</SelectItem>
                  <SelectItem value="vba">VBA</SelectItem>
                </SelectContent>
              </Select>
              {selectedMacroId && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-red-500 hover:text-red-600"
                  onClick={handleDeleteMacro}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            {/* Code editor */}
            <div className="flex-1 relative">
              <textarea
                className="w-full h-full p-3 text-sm font-mono bg-gray-900 text-green-400 outline-none resize-none"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={language === 'python' ? '# Введите код Python\n# Доступны: wb, ws, pd, np' : "' Введите код VBA"}
                spellCheck={false}
                disabled={isRunning}
              />
              {isRunning && (
                <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-green-400" />
                </div>
              )}
            </div>

            {/* Output console */}
            <div className="h-28 border-t border-gray-200 bg-gray-950">
              <div className="px-3 py-1 border-b border-gray-800 text-[10px] text-gray-500 font-mono flex items-center justify-between">
                <span>Консоль</span>
                {isRunning && <span className="text-yellow-500">Выполняется...</span>}
              </div>
              <ScrollArea className="h-[calc(100%-20px)]">
                <div className="p-2 font-mono text-xs text-gray-400">
                  {output.length === 0 ? (
                    <span className="text-gray-600">Готово к выполнению</span>
                  ) : (
                    output.map((line, i) => (
                      <div key={i} className={`leading-5 ${
                        line.includes('❌') ? 'text-red-400' :
                        line.includes('✅') ? 'text-green-400' :
                        line.includes('⚠') ? 'text-yellow-400' :
                        'text-gray-400'
                      }`}>
                        {line}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}