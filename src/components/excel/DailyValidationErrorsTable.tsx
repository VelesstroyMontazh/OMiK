'use client'

import React from 'react'
import DailyTableScrollBox from '@/components/excel/DailyTableScrollBox'
import type { DailyValidationError } from '@/components/excel/DailyAccountingValidationDialog'

export default function DailyValidationErrorsTable({
  errors,
  emptyText = 'Ошибок не обнаружено.',
}: {
  errors: DailyValidationError[]
  emptyText?: string
}) {
  if (errors.length === 0) {
    return <p className="p-4 text-sm text-green-800">{emptyText}</p>
  }

  return (
    <DailyTableScrollBox className="flex-1 min-h-[160px] border rounded-lg bg-white">
      <table className="text-xs border-collapse" style={{ width: 'max-content', minWidth: '100%' }}>
        <thead className="sticky top-0 bg-gray-50 border-b z-10">
          <tr>
            <th className="text-left px-2 py-1.5 whitespace-nowrap min-w-[88px]">Проверка</th>
            <th className="text-left px-2 py-1.5 whitespace-nowrap min-w-[56px]">Строка</th>
            <th className="text-left px-2 py-1.5 whitespace-nowrap min-w-[120px]">Площадка</th>
            <th className="text-left px-2 py-1.5 whitespace-nowrap min-w-[72px]">Таб. №</th>
            <th className="text-left px-2 py-1.5 whitespace-nowrap min-w-[140px]">Ф.И.О.</th>
            <th className="text-left px-2 py-1.5 whitespace-nowrap min-w-[280px]">Сообщение</th>
          </tr>
        </thead>
        <tbody>
          {errors.map((e, i) => (
            <tr key={i} className="border-b border-gray-100 align-top">
              <td className="px-2 py-1.5 whitespace-nowrap">{e.check}</td>
              <td className="px-2 py-1.5">{e.row}</td>
              <td className="px-2 py-1.5">{e.locationId || '—'}</td>
              <td className="px-2 py-1.5">{String(e.tabNumber ?? '—')}</td>
              <td className="px-2 py-1.5">{String(e.fio ?? '—')}</td>
              <td className="px-2 py-1.5">
                <div>{e.message}</div>
                {e.mainDb && (
                  <div className="text-gray-500 mt-0.5">
                    База: таб. {String(e.mainDb['Таб. номер'] ?? '—')}, ФИО{' '}
                    {String(e.mainDb['ФИО'] ?? '—')}, площадка {String(e.mainDb['Площадка'] ?? '—')},
                    приём {String(e.mainDb['Дата приема'] ?? '—')}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DailyTableScrollBox>
  )
}
