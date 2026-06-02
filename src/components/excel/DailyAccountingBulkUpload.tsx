'use client'

import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useExcelApi } from '@/hooks/use-excel-api'
import type { DailySiteItem } from '@/hooks/excel-api/daily'
import type { AppUser } from '@/lib/app-auth'
import { Button } from '@/components/ui/button'
import DailyTableScrollBox from '@/components/excel/DailyTableScrollBox'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type BulkEntry = {
  file: File
  locationId: string
  status: 'pending' | 'uploading' | 'done' | 'error'
  message?: string
}

function matchSiteByFileName(fileName: string, sites: DailySiteItem[]): string {
  const lower = fileName.toLowerCase().replace(/[_\-\s.]/g, '')
  const base = lower.replace(/xlsx|xls$/i, '')
  let best = ''
  let bestLen = 0
  for (const loc of sites) {
    const key = loc.name.toLowerCase().replace(/[_\-\s]/g, '')
    if (!key) continue
    if (lower.includes(key) || key.includes(base)) {
      if (key.length > bestLen) {
        best = loc.name
        bestLen = key.length
      }
    }
  }
  return best
}

export default function DailyAccountingBulkUpload({
  open,
  onClose,
  sites,
  defaultDate,
  user,
  onStartUpload,
  onUploaded,
}: {
  open: boolean
  onClose: () => void
  sites: DailySiteItem[]
  defaultDate: string
  user: AppUser
  /** Полный цикл загрузки со статус-баром (если задан — внутренний цикл не используется) */
  onStartUpload?: (
    entries: BulkEntry[],
    bulkDate: string,
    ui: {
      setUploading: (v: boolean) => void
      setEntries: React.Dispatch<React.SetStateAction<BulkEntry[]>>
    },
  ) => Promise<void>
  /** После успешной загрузки файла по площадке */
  onUploaded?: (locationId: string, rowCount: number) => void
}) {
  const api = useExcelApi()
  const fileInputId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const [entries, setEntries] = useState<BulkEntry[]>([])
  const [bulkDate, setBulkDate] = useState(defaultDate)
  const [uploading, setUploading] = useState(false)

  const activeSites = useMemo(
    () => sites.filter((s) => s.opStatus === 'active'),
    [sites],
  )

  useEffect(() => {
    if (open) {
      setBulkDate(defaultDate)
      setEntries([])
      setUploading(false)
    }
  }, [open, defaultDate])

  const onFiles = (files: FileList | null) => {
    if (!files?.length) return
    const list = Array.from(files).filter((f) => /\.xlsx?$/i.test(f.name))
    if (!list.length) return
    setEntries(
      list.map((file) => ({
        file,
        locationId: matchSiteByFileName(file.name, activeSites.length ? activeSites : sites),
        status: 'pending' as const,
      })),
    )
    if (fileRef.current) fileRef.current.value = ''
  }

  const setEntrySite = (idx: number, locationId: string) => {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, locationId } : e)))
  }

  const uploadAll = async () => {
    const unassigned = entries.filter((e) => !e.locationId)
    if (unassigned.length) {
      setEntries((prev) =>
        prev.map((e) =>
          !e.locationId ? { ...e, status: 'error', message: 'Укажите площадку' } : e,
        ),
      )
      return
    }
    if (!bulkDate) return

    if (onStartUpload) {
      await onStartUpload(entries, bulkDate, { setUploading, setEntries })
      return
    }

    setUploading(true)
    const updated = [...entries]
    let okCount = 0
    let errCount = 0
    for (let i = 0; i < updated.length; i++) {
      const entry = updated[i]!
      updated[i] = { ...entry, status: 'uploading' }
      setEntries([...updated])
      try {
        const body = await api.dailyUpload({
          file: entry.file,
          locationId: entry.locationId,
          date: bulkDate,
          replaceSiteDate: true,
          user,
        })
        const count = (body as { rowCount?: number }).rowCount ?? 0
        okCount += 1
        updated[i] = {
          ...entry,
          status: 'done',
          message: `${count} чел.`,
        }
        onUploaded?.(entry.locationId, count)
      } catch (e) {
        errCount += 1
        updated[i] = { ...entry, status: 'error', message: e instanceof Error ? e.message : 'Ошибка' }
      }
      setEntries([...updated])
    }
    setUploading(false)
  }

  const allAssigned = entries.length > 0 && entries.every((e) => e.locationId)
  const doneCount = entries.filter((e) => e.status === 'done').length
  const selectCls = 'h-7 w-full rounded border border-gray-300 px-2 text-xs'

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !uploading) onClose()
      }}
    >
      <DialogContent
        className="max-w-2xl max-h-[90vh] flex flex-col gap-3 sm:max-w-2xl"
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Массовая загрузка ежедневных учётов</DialogTitle>
          <DialogDescription>
            Выберите файлы Excel (лист «ЕЖЕДНЕВНЫЙ УЧЕТ»). Для каждого файла укажите площадку, если не подставилась автоматически.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-gray-500">Дата учёта</span>
            <Input
              type="date"
              className="h-8 w-40"
              value={bulkDate}
              onChange={(e) => setBulkDate(e.target.value)}
            />
          </label>
          <input
            id={fileInputId}
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            multiple
            className="sr-only"
            onChange={(e) => onFiles(e.target.files)}
          />
          <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
            <label htmlFor={fileInputId} className="cursor-pointer">
              Выбрать файлы…
            </label>
          </Button>
          {entries.length > 0 && (
            <span className="text-xs text-gray-500 pb-1">{entries.length} файл(ов)</span>
          )}
        </div>

        {entries.length > 0 ? (
          <DailyTableScrollBox className="flex-1 min-h-[160px] max-h-[40vh] border rounded-lg bg-white shrink-0">
            <table className="text-xs border-collapse" style={{ width: 'max-content', minWidth: 640 }}>
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="border-b">
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Файл</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 w-56">Площадка</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 w-28">Статус</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => (
                  <tr key={`${entry.file.name}-${idx}`} className="border-b">
                    <td className="px-3 py-2 max-w-[240px] truncate" title={entry.file.name}>
                      {entry.file.name}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className={selectCls}
                        value={entry.locationId}
                        disabled={entry.status === 'done' || uploading}
                        onChange={(e) => setEntrySite(idx, e.target.value)}
                      >
                        <option value="">— выберите площадку —</option>
                        {(activeSites.length ? activeSites : sites).map((s) => (
                          <option key={s.name} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {entry.status === 'pending' && <span className="text-gray-400">—</span>}
                      {entry.status === 'uploading' && (
                        <span className="text-blue-600">Загрузка…</span>
                      )}
                      {entry.status === 'done' && (
                        <span className="text-green-700 font-medium">✓ {entry.message}</span>
                      )}
                      {entry.status === 'error' && (
                        <span className="text-red-600" title={entry.message}>✗ {entry.message}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DailyTableScrollBox>
        ) : (
          <div className="py-10 text-center text-sm text-gray-500 border rounded-lg bg-gray-50">
            Нажмите «Выбрать файлы…» — появится таблица сопоставления файлов и площадок
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={uploading}>
            Закрыть
          </Button>
          <Button
            type="button"
            disabled={!allAssigned || uploading || !bulkDate || doneCount === entries.length || entries.length === 0}
            onClick={() => void uploadAll()}
          >
            {uploading
              ? 'Загрузка…'
              : `Загрузить всё (${entries.filter((e) => e.status !== 'done').length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
