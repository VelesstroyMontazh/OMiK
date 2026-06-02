'use client'

import React, { createContext, useCallback, useContext, useState } from 'react'
import { useExcelStore } from '@/store/excel-store'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2 } from 'lucide-react'

export interface DetectedVbaMacro {
  id: string
  name: string
  code: string
  stream?: string
  partial?: boolean
}

interface PendingVba {
  filePath: string
  fileName: string
  macros: DetectedVbaMacro[]
}

interface VbaPromptContextValue {
  checkFileForVba: (filePath: string, fileName: string) => Promise<void>
  openVbaLaboratory: () => void
}

const VbaPromptContext = createContext<VbaPromptContextValue | null>(null)

const VBA_EXT = new Set(['.xlsm', '.xls', '.xla', '.xlam', '.xltm'])

function hasVbaExtension(name: string) {
  const i = name.lastIndexOf('.')
  if (i < 0) return false
  return VBA_EXT.has(name.slice(i).toLowerCase())
}

export function VbaPromptProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingVba | null>(null)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)

  const openVbaLaboratory = useCallback(() => {
    useExcelStore.getState().navigateTo({
      id: 'vba-laboratory',
      name: 'Лаборатория VBA+PY',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      size: 0,
    })
  }, [])

  const checkFileForVba = useCallback(async (filePath: string, fileName: string) => {
    if (!hasVbaExtension(fileName)) return

    setLoading(true)
    try {
      const sp = new URLSearchParams({ action: 'detect', file_path: filePath })
      const res = await fetch(`/api/excel/vba-laboratory?${sp.toString()}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.has_vba || !Array.isArray(data.macros) || data.macros.length === 0) {
        return
      }
      setPending({
        filePath,
        fileName,
        macros: data.macros as DetectedVbaMacro[],
      })
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  const handleImportYes = useCallback(async () => {
    if (!pending) return
    setImporting(true)
    try {
      const res = await fetch('/api/excel/vba-laboratory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_path: pending.filePath,
          source_label: pending.fileName,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((data as { detail?: string }).detail || 'Ошибка импорта VBA')
      }
      const store = useExcelStore.getState()
      for (const m of pending.macros) {
        if (m.partial) continue
        const exists = store.macros.some((x) => x.id === `lab-${m.id}`)
        if (!exists) {
          store.addMacro({
            id: `lab-${m.id}`,
            name: m.name,
            language: 'vba',
            code: m.code,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          })
        }
      }
      setPending(null)
      openVbaLaboratory()
    } catch (e) {
      console.error(e)
      setPending(null)
    } finally {
      setImporting(false)
    }
  }, [pending, openVbaLaboratory])

  return (
    <VbaPromptContext.Provider value={{ checkFileForVba, openVbaLaboratory }}>
      {children}
      {loading && (
        <div className="fixed bottom-4 right-4 z-[100] flex items-center gap-2 rounded-lg bg-white border shadow px-3 py-2 text-xs text-gray-600">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Проверка VBA…
        </div>
      )}
      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Хотите добавить VBA в Лабораторию?</AlertDialogTitle>
            <AlertDialogDescription>
              В файле <strong>{pending?.fileName}</strong> найдены макросы VBA. Их можно сохранить во вкладке
              «Лаборатория VBA+PY» и применять в программе.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ScrollArea className="max-h-48 border rounded-md p-2 bg-gray-50">
            <ul className="text-xs space-y-1">
              {pending?.macros.map((m) => (
                <li key={m.id} className="font-mono text-gray-800">
                  • {m.name}
                  {m.partial ? ' (только обнаружен проект)' : ''}
                </li>
              ))}
            </ul>
          </ScrollArea>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={importing}>Нет</AlertDialogCancel>
            <AlertDialogAction disabled={importing} onClick={() => void handleImportYes()}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Да'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </VbaPromptContext.Provider>
  )
}

export function useVbaPrompt() {
  const ctx = useContext(VbaPromptContext)
  if (!ctx) {
    throw new Error('useVbaPrompt must be used within VbaPromptProvider')
  }
  return ctx
}
