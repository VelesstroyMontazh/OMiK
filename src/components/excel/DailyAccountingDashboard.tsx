'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useExcelApi } from '@/hooks/use-excel-api'
import { Button } from '@/components/ui/button'
import DailyTableScrollBox from '@/components/excel/DailyTableScrollBox'
import { Loader2 } from 'lucide-react'

type DailyStats = {
  total?: number
  aup?: number
  itr?: number
  rop?: number
  byCategory?: Array<{ citizenship: string; category: string; count: number }>
}

function CategoryMatrix({ byCategory }: { byCategory: DailyStats['byCategory'] }) {
  const rows = useMemo(() => {
    const map = new Map<string, { AUP: number; ITR: number; ROP: number }>()
    for (const item of byCategory || []) {
      const c = item.citizenship || '—'
      const bucket = map.get(c) ?? { AUP: 0, ITR: 0, ROP: 0 }
      const cat = item.category as 'AUP' | 'ITR' | 'ROP'
      if (cat === 'AUP' || cat === 'ITR' || cat === 'ROP') {
        bucket[cat] += item.count
      }
      map.set(c, bucket)
    }
    return [...map.entries()]
      .map(([citizenship, counts]) => ({
        citizenship,
        ...counts,
        total: counts.AUP + counts.ITR + counts.ROP,
      }))
      .filter((r) => r.total > 0)
      .sort((a, b) => a.citizenship.localeCompare(b.citizenship, 'ru'))
  }, [byCategory])

  if (!rows.length) return null

  return (
    <DailyTableScrollBox className="flex-1 min-h-[120px] border rounded-lg bg-white">
      <table className="text-xs border-collapse" style={{ width: 'max-content', minWidth: '100%' }}>
        <thead>
          <tr className="bg-gray-50">
            <th className="border px-2 py-1 text-left">Гражданство</th>
            <th className="border px-2 py-1 text-right">АУП</th>
            <th className="border px-2 py-1 text-right">ИТР</th>
            <th className="border px-2 py-1 text-right">РОП</th>
            <th className="border px-2 py-1 text-right">Итого</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.citizenship}>
              <td className="border px-2 py-1">{r.citizenship}</td>
              <td className="border px-2 py-1 text-right tabular-nums">{r.AUP || '—'}</td>
              <td className="border px-2 py-1 text-right tabular-nums">{r.ITR || '—'}</td>
              <td className="border px-2 py-1 text-right tabular-nums">{r.ROP || '—'}</td>
              <td className="border px-2 py-1 text-right font-medium tabular-nums">{r.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </DailyTableScrollBox>
  )
}

export default function DailyAccountingDashboard({ date }: { date: string }) {
  const api = useExcelApi()
  const [stats, setStats] = useState<DailyStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!date) return
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const data = (await api.dailyStats({ date, combined: true })) as DailyStats
        setStats(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка сводки')
        setStats(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [api, date])

  const total = stats?.total ?? 0
  const aup = stats?.aup ?? 0
  const itr = stats?.itr ?? 0
  const rop = stats?.rop ?? 0

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      <div className="text-sm font-semibold text-gray-800">Свод (дашборд) за {date}</div>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">{error}</div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-6 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Загрузка сводки…
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ['Всего на объектах', total],
              ['АУП', aup],
              ['ИТР', itr],
              ['РОП', rop],
            ].map(([label, val]) => (
              <div key={label} className="bg-white border rounded-lg p-3 text-center shadow-sm">
                <div className="text-2xl font-bold text-indigo-700 tabular-nums">{val}</div>
                <div className="text-xs text-gray-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          <div className="bg-white border rounded-lg shadow-sm min-w-0 flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b shrink-0">
              <div className="font-semibold text-sm">Гражданство × АУП / ИТР / РОП</div>
              <div className="text-xs text-gray-500">
                Свод по гражданству (три категории вместо ITR/R в Excel)
              </div>
            </div>
            <div className="flex-1 min-h-0 p-3">
              {total === 0 ? (
                <p className="text-sm text-gray-500 py-6 text-center">
                  Нет данных. ОП должны загрузить ежедневные учёты.
                </p>
              ) : stats?.byCategory?.length ? (
                <CategoryMatrix byCategory={stats.byCategory} />
              ) : (
                <p className="text-sm text-gray-500 py-4 text-center">Нет разбивки по категориям</p>
              )}
            </div>
          </div>

          <Button size="sm" variant="outline" className="h-8" onClick={() => {
            setLoading(true)
            void api.dailyStats({ date, combined: true }).then((d) => {
              setStats(d as DailyStats)
              setLoading(false)
            }).catch((e) => {
              setError(e instanceof Error ? e.message : 'Ошибка')
              setLoading(false)
            })
          }}>
            Обновить сводку
          </Button>
        </>
      )}
    </div>
  )
}
