'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useExcelStore } from '@/store/excel-store'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Code2, Loader2, Play, Save, Trash2 } from 'lucide-react'
import { useExcelApi } from '@/hooks/use-excel-api'

interface LabMacro {
  id: string
  name: string
  code: string
  language: string
  source_file?: string
  source_label?: string
  imported_at?: string
  partial?: boolean
}

export default function VbaLaboratoryPanel() {
  const api = useExcelApi()
  const addMacro = useExcelStore((s) => s.addMacro)
  const programMacros = useExcelStore((s) => s.macros)

  const [macros, setMacros] = useState<LabMacro[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const selected = macros.find((m) => m.id === selectedId) ?? null

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/excel/vba-laboratory')
      const data = await res.json()
      if (!res.ok) throw new Error((data as { detail?: string }).detail || 'Ошибка загрузки')
      const list = (data.macros || []) as LabMacro[]
      setMacros(list)
      if (list.length && !selectedId) {
        setSelectedId(list[0].id)
        setName(list[0].name)
        setCode(list[0].code)
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (selected) {
      setName(selected.name)
      setCode(selected.code)
    }
  }, [selected])

  const handleSave = async () => {
    if (!selectedId) return
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/excel/vba-laboratory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ macro_id: selectedId, name, code, language: 'vba' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error((data as { detail?: string }).detail || 'Ошибка сохранения')
      setMessage('Сохранено в лаборатории')
      await refresh()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setSaving(false)
    }
  }

  const handleApplyToProgram = () => {
    if (!selectedId || !code.trim()) return
    const progId = `lab-${selectedId}`
    const existing = programMacros.find((m) => m.id === progId)
    if (existing) {
      useExcelStore.getState().updateMacro(progId, { name, code, language: 'vba' })
    } else {
      addMacro({
        id: progId,
        name,
        language: 'vba',
        code,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    }
    useExcelStore.getState().setSidebarOpen(true)
    useExcelStore.getState().setSidebarTab('macros')
    useExcelStore.getState().setMacroEditorOpen(true)
    setMessage('Макрос добавлен в программу (вкладка «Макросы»)')
  }

  const handleDelete = async () => {
    if (!selectedId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/excel/vba-laboratory?macro_id=${encodeURIComponent(selectedId)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error((data as { detail?: string }).detail || 'Ошибка удаления')
      }
      setSelectedId(null)
      await refresh()
      setMessage('Удалено')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setSaving(false)
    }
  }

  const handleRun = async () => {
    const filePath = useExcelStore.getState().currentFilePath
    if (!filePath) {
      setMessage('Откройте Excel-файл в редакторе, чтобы выполнить макрос на книге')
      return
    }
    setRunning(true)
    setMessage(null)
    try {
      const result = await api.executeMacro(filePath, code, 'vba')
      setMessage(
        result.success
          ? `Выполнено: ${(result.output || []).join('; ') || 'OK'}`
          : `Ошибка: ${(result.errors || []).join('; ')}`,
      )
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ошибка выполнения')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gradient-to-br from-slate-50 to-violet-50">
      <div className="px-4 py-3 border-b bg-white/80 flex items-center gap-2">
        <Code2 className="h-5 w-5 text-violet-600" />
        <div>
          <h2 className="text-sm font-bold text-gray-800">Лаборатория VBA+PY</h2>
          <p className="text-[10px] text-gray-500">Импорт из .xlsm/.xls • редактирование • применение к программе</p>
        </div>
        <Button size="sm" variant="outline" className="ml-auto h-8" onClick={() => void refresh()} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Обновить'}
        </Button>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="w-56 border-r bg-white flex flex-col">
          <p className="text-[10px] font-semibold text-gray-500 px-3 py-2">Сохранённые макросы</p>
          <ScrollArea className="flex-1">
            {macros.length === 0 ? (
              <p className="text-[11px] text-gray-400 px-3 py-4">Пока пусто. Загрузите .xlsm с VBA в любой вкладке.</p>
            ) : (
              <ul>
                {macros.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(m.id)}
                      className={`w-full text-left px-3 py-2 text-[11px] border-b hover:bg-violet-50 ${
                        selectedId === m.id ? 'bg-violet-100 text-violet-900 font-medium' : 'text-gray-700'
                      }`}
                    >
                      {m.name}
                      {m.source_label && (
                        <span className="block text-[9px] text-gray-400 truncate">{m.source_label}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>

        <div className="flex-1 flex flex-col min-w-0 p-3 gap-2">
          {selected ? (
            <>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-8 rounded border px-2 text-sm font-medium"
                placeholder="Имя макроса"
              />
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="flex-1 min-h-[200px] font-mono text-xs border rounded p-2 resize-none"
                spellCheck={false}
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
                  <Save className="h-3.5 w-3.5 mr-1" />
                  Сохранить
                </Button>
                <Button size="sm" variant="outline" onClick={handleApplyToProgram}>
                  <Code2 className="h-3.5 w-3.5 mr-1" />
                  Применить к программе
                </Button>
                <Button size="sm" variant="outline" onClick={() => void handleRun()} disabled={running}>
                  {running ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1" />}
                  Выполнить на открытой книге
                </Button>
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => void handleDelete()} disabled={saving}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Удалить
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">Выберите макрос слева или импортируйте из файла с VBA.</p>
          )}
          {message && (
            <p className="text-xs text-violet-800 bg-violet-50 border border-violet-200 rounded px-2 py-1">{message}</p>
          )}
        </div>
      </div>
    </div>
  )
}
