'use client'

import React, { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import DailyValidationErrorsTable from '@/components/excel/DailyValidationErrorsTable'
import type { DailyValidationError } from '@/components/excel/DailyAccountingValidationDialog'
import { ClipboardCheck, Loader2 } from 'lucide-react'

export type DailyValidationScopeResult = {
  scopeId: string
  label: string
  combined: boolean
  rowCount: number
  errorCount: number
  hasErrors: boolean
  errors: DailyValidationError[]
  checkedAt?: number
  loadError?: string
  canValidate: boolean
}

export default function DailyAccountingValidationSummary({
  dateLabel,
  scopes,
  selectedScopeId,
  onSelectScope,
  validating,
  onRunAll,
  onRunScope,
}: {
  dateLabel: string
  scopes: DailyValidationScopeResult[]
  selectedScopeId: string | null
  onSelectScope: (scopeId: string | null) => void
  validating: boolean
  onRunAll: () => void
  onRunScope: (scopeId: string) => void
}) {
  const totals = useMemo(() => {
    let rowCount = 0
    let errorCount = 0
    let checked = 0
    for (const s of scopes) {
      if (s.checkedAt) {
        checked += 1
        rowCount += s.rowCount
        errorCount += s.errorCount
      }
    }
    return { rowCount, errorCount, checked }
  }, [scopes])

  const selected = scopes.find((s) => s.scopeId === selectedScopeId) ?? null

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2 shrink-0">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Итог проверок</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Дата учёта: {dateLabel}. Проверка_3/4 — задвоения; Проверка_1/2 — Основная БД.
            {totals.checked > 0 && (
              <>
                {' '}
                Проверено областей: {totals.checked}, строк: {totals.rowCount.toLocaleString('ru-RU')},
                ошибок:{' '}
                <span className={totals.errorCount > 0 ? 'text-red-700 font-medium' : 'text-green-700'}>
                  {totals.errorCount.toLocaleString('ru-RU')}
                </span>
              </>
            )}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-8"
          disabled={validating || scopes.every((s) => !s.canValidate)}
          onClick={onRunAll}
        >
          {validating ? (
            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
          ) : (
            <ClipboardCheck className="h-3.5 w-3.5 mr-1" />
          )}
          {validating ? 'Проверка…' : 'Проверить все'}
        </Button>
      </div>

      <div className="shrink-0 border border-gray-200 rounded-lg bg-white overflow-auto max-h-[40vh]">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b sticky top-0">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Область</th>
              <th className="text-right px-3 py-2 font-medium whitespace-nowrap">Строк</th>
              <th className="text-right px-3 py-2 font-medium whitespace-nowrap">Ошибок</th>
              <th className="text-left px-3 py-2 font-medium">Статус</th>
              <th className="text-right px-3 py-2 font-medium whitespace-nowrap">Действия</th>
            </tr>
          </thead>
          <tbody>
            {scopes.map((s) => {
              const isSelected = selectedScopeId === s.scopeId
              let status: React.ReactNode
              if (s.loadError) {
                status = <span className="text-amber-800">Ошибка</span>
              } else if (!s.checkedAt) {
                status = <span className="text-gray-400">Не проверено</span>
              } else if (s.hasErrors) {
                status = <span className="text-red-700 font-medium">Есть ошибки</span>
              } else {
                status = <span className="text-green-700">OK</span>
              }
              return (
                <tr
                  key={s.scopeId}
                  className={`border-b border-gray-100 ${isSelected ? 'bg-amber-50' : 'hover:bg-gray-50'}`}
                >
                  <td className="px-3 py-2 font-medium text-gray-800">{s.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {s.checkedAt ? s.rowCount.toLocaleString('ru-RU') : '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {s.checkedAt ? (
                      <span className={s.errorCount > 0 ? 'text-red-700 font-medium' : ''}>
                        {s.errorCount.toLocaleString('ru-RU')}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2">{status}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      disabled={!s.canValidate || validating}
                      onClick={() => onRunScope(s.scopeId)}
                    >
                      Проверить
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      disabled={!s.checkedAt || !s.errors.length}
                      onClick={() => onSelectScope(isSelected ? null : s.scopeId)}
                    >
                      {isSelected ? 'Скрыть' : 'Подробнее'}
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {scopes.length === 0 && (
          <p className="p-4 text-sm text-gray-500">Нет доступных площадок для проверки.</p>
        )}
      </div>

      {selected && (
        <div className="flex flex-col flex-1 min-h-0 min-w-0 gap-1">
          <p className="text-xs font-medium text-gray-700 shrink-0">
            {selected.label} — ошибки ({selected.errors.length.toLocaleString('ru-RU')})
            {selected.loadError && (
              <span className="text-amber-800 font-normal"> — {selected.loadError}</span>
            )}
          </p>
          <DailyValidationErrorsTable errors={selected.errors} />
        </div>
      )}

      {!selected && totals.checked === 0 && scopes.length > 0 && (
        <p className="text-sm text-gray-500">
          Нажмите «Проверить все» или «Проверить» у отдельной площадки. Результаты с кнопки «Проверить отчёт» на
          вкладках тоже попадают сюда.
        </p>
      )}
    </div>
  )
}
