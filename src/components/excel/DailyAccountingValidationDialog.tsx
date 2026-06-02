'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import DailyValidationErrorsTable from '@/components/excel/DailyValidationErrorsTable'

export type DailyValidationError = {
  check: string
  row: number
  locationId?: string
  tabNumber?: string
  fio?: string
  field?: string
  message: string
  mainDb?: Record<string, unknown>
}

export default function DailyAccountingValidationDialog({
  open,
  onClose,
  title,
  errors,
  rowCount,
}: {
  open: boolean
  onClose: () => void
  title: string
  errors: DailyValidationError[]
  rowCount: number
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Проверено строк: {rowCount.toLocaleString('ru-RU')}. Ошибок:{' '}
            <strong className="text-red-700">{errors.length.toLocaleString('ru-RU')}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-[180px] max-h-[50vh] flex flex-col min-w-0">
          <DailyValidationErrorsTable errors={errors} />
        </div>
        <DialogFooter>
          <Button type="button" size="sm" onClick={onClose}>
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
