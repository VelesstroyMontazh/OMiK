'use client'

import React, { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BarChart3, Download, Loader2, RefreshCw } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'

export interface TicketCostsDashboardData {
  kpi: { total_sum: number; ticket_count: number; site_count: number }
  by_podrazdelenie: Array<{ podrazdelenie: string; summa: number; tickets: number; avg_check?: number }>
  by_time: Array<{ _year: number; _month: number; summa: number; tickets?: number }>
  operations: { total: number; pokupka: number; obmen: number; vozvrat: number }
  by_obosnovanie: Array<{ obosnovanie_pereleta: string; tickets: number; summa: number }>
  by_aviaperevozchik?: Array<{ aviaperevozchik: string; summa: number; tickets: number }>
  top_marshruty?: Array<{ marshrut: string; summa: number; trips: number; avg_cost: number }>
  top_employees?: Array<{ fio: string; trips: number; summa: number; avg_cost?: number }>
  filters: {
    years: number[]
    months: number[]
    podrazdeleniya: string[]
    obosnovaniya: string[]
    organizacii?: string[]
    klassifikacii?: string[]
    aviaperevozchiki?: string[]
  }
}

const MONTH_NAMES = [
  '', 'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
  'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек',
]

const CHART_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b']

function formatMoney(n: number) {
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 0 })
}

function formatMoneyFull(n: number) {
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })
}

function shortObosn(label: string, max = 28) {
  const s = label.trim()
  if (s.length <= max) return s
  return `${s.slice(0, max - 1)}…`
}

function HBarChart({
  data,
  labelKey,
  valueKey,
  onBarClick,
  formatLabel,
}: {
  data: Array<Record<string, unknown>>
  labelKey: string
  valueKey: string
  onBarClick?: (label: string) => void
  formatLabel?: (v: string) => string
}) {
  const chartData = data.map((d) => ({
    name: formatLabel ? formatLabel(String(d[labelKey] ?? '')) : String(d[labelKey] ?? '—'),
    fullName: String(d[labelKey] ?? ''),
    value: Number(d[valueKey] ?? 0),
    tickets: Number(d.tickets ?? 0),
    avg: Number(d.avg_check ?? d.avg_cost ?? 0),
  }))
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 28)}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tickFormatter={(v) => formatMoney(Number(v))} fontSize={10} />
        <YAxis type="category" dataKey="name" width={120} fontSize={10} />
        <Tooltip
          formatter={(v: number) => [`${formatMoneyFull(v)} ₽`, 'Сумма']}
          labelFormatter={(_, p) => {
            const row = p?.[0]?.payload as { fullName?: string; tickets?: number; avg?: number } | undefined
            if (!row) return ''
            return (
              <div className="text-xs space-y-0.5">
                <div>{row.fullName}</div>
                <div>Билетов: {row.tickets ?? '—'}</div>
                {row.avg ? <div>Средний чек: {formatMoneyFull(row.avg)} ₽</div> : null}
              </div>
            )
          }}
        />
        <Bar
          dataKey="value"
          fill="#4f46e5"
          radius={[0, 4, 4, 0]}
          cursor={onBarClick ? 'pointer' : 'default'}
          onClick={(d) => onBarClick?.(String((d as { fullName?: string }).fullName ?? ''))}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function TicketCostsFiltersBar({
  filterOptions,
  year,
  month,
  podrazdelenie,
  obosnovanie,
  organizaciya,
  klassifikaciya,
  aviaperevozchik,
  onYear,
  onMonth,
  onPodrazdelenie,
  onObosnovanie,
  onOrganizaciya,
  onKlassifikaciya,
  onAviaperevozchik,
  onApply,
  onReset,
  onRefresh,
  onExport,
}: {
  filterOptions?: TicketCostsDashboardData['filters']
  year: string
  month: string
  podrazdelenie: string
  obosnovanie: string
  organizaciya: string
  klassifikaciya: string
  aviaperevozchik: string
  onYear: (v: string) => void
  onMonth: (v: string) => void
  onPodrazdelenie: (v: string) => void
  onObosnovanie: (v: string) => void
  onOrganizaciya: (v: string) => void
  onKlassifikaciya: (v: string) => void
  onAviaperevozchik: (v: string) => void
  onApply: () => void
  onReset?: () => void
  onRefresh?: () => void
  onExport?: () => void
}) {
  const activeCount = [year, month, podrazdelenie, obosnovanie, organizaciya, klassifikaciya, aviaperevozchik].filter(Boolean).length

  const selectCls = 'h-8 min-w-[130px] rounded border border-gray-300 px-2 text-xs'

  return (
    <motion.div className="flex flex-wrap items-center gap-2 text-[11px] bg-slate-50 border border-slate-200 rounded-lg p-2">
      {activeCount > 0 && (
        <span className="text-indigo-700 font-medium px-1">🔍 {activeCount}</span>
      )}
      <label className="text-gray-500">Площадка</label>
      <select value={podrazdelenie} onChange={(e) => onPodrazdelenie(e.target.value)} className={selectCls}>
        <option value="">Все</option>
        {(filterOptions?.podrazdeleniya || []).map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      <label className="text-gray-500">Организация</label>
      <select value={organizaciya} onChange={(e) => onOrganizaciya(e.target.value)} className={selectCls}>
        <option value="">Все</option>
        {(filterOptions?.organizacii || []).map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      <label className="text-gray-500">Классификация</label>
      <select value={klassifikaciya} onChange={(e) => onKlassifikaciya(e.target.value)} className={selectCls}>
        <option value="">Все</option>
        {(filterOptions?.klassifikacii || []).map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      <label className="text-gray-500">Перевозчик</label>
      <select value={aviaperevozchik} onChange={(e) => onAviaperevozchik(e.target.value)} className={selectCls}>
        <option value="">Все</option>
        {(filterOptions?.aviaperevozchiki || []).map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      <label className="text-gray-500">Год</label>
      <select value={year} onChange={(e) => onYear(e.target.value)} className="h-8 w-20 rounded border border-gray-300 px-2 text-xs">
        <option value="">Все</option>
        {(filterOptions?.years || []).map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
      <label className="text-gray-500">Месяц</label>
      <select value={month} onChange={(e) => onMonth(e.target.value)} className="h-8 w-20 rounded border border-gray-300 px-2 text-xs">
        <option value="">Все</option>
        {(filterOptions?.months || []).map((m) => (
          <option key={m} value={m}>{MONTH_NAMES[m] || m}</option>
        ))}
      </select>
      <label className="text-gray-500">Обоснование</label>
      <select value={obosnovanie} onChange={(e) => onObosnovanie(e.target.value)} className={selectCls}>
        <option value="">Все</option>
        {(filterOptions?.obosnovaniya || []).map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <Button size="sm" variant="outline" className="h-8" onClick={onApply}>Применить</Button>
      {onReset && (
        <Button size="sm" variant="ghost" className="h-8" onClick={onReset}>Сбросить</Button>
      )}
      {onRefresh && (
        <Button size="sm" variant="ghost" className="h-8" onClick={onRefresh}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          Обновить
        </Button>
      )}
      {onExport && (
        <Button size="sm" variant="secondary" className="h-8 ml-auto" onClick={onExport}>
          <Download className="h-3.5 w-3.5 mr-1" />
          Экспорт CSV
        </Button>
      )}
    </motion.div>
  )
}

export default function TicketCostsDashboardView({
  dashboard,
  loading,
  emptyHint,
  onFilterPodrazdelenie,
  onFilterCarrier,
}: {
  dashboard: TicketCostsDashboardData | null
  loading: boolean
  emptyHint?: string
  onFilterPodrazdelenie?: (v: string) => void
  onFilterCarrier?: (v: string) => void
}) {
  const [obosnTop, setObosnTop] = useState<5 | 10 | 15>(10)

  const timeChart = useMemo(() => {
    if (!dashboard?.by_time) return []
    return dashboard.by_time.map((t) => ({
      period: `${MONTH_NAMES[t._month] || t._month} ${t._year}`,
      summa: t.summa,
      tickets: t.tickets ?? 0,
    }))
  }, [dashboard])

  const carrierPie = useMemo(() => {
    const rows = dashboard?.by_aviaperevozchik?.slice(0, 8) || []
    return rows.map((r) => ({
      name: String(r.aviaperevozchik || '—').slice(0, 24),
      fullName: String(r.aviaperevozchik || ''),
      value: r.summa,
      tickets: r.tickets,
    }))
  }, [dashboard])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 p-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Загрузка отчёта…
      </div>
    )
  }

  if (!dashboard) {
    return <p className="text-sm text-gray-500 p-4">{emptyHint || 'Нет данных для отчёта.'}</p>
  }

  const obosnRows = dashboard.by_obosnovanie.slice(0, obosnTop)

  return (
    <div className="space-y-5 font-sans text-sm">
      <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="text-xs text-slate-500 uppercase tracking-wide font-medium">Общая сумма расходов</div>
          <motion.div className="text-2xl font-bold text-indigo-700 mt-2">{formatMoneyFull(dashboard.kpi.total_sum)} ₽</motion.div>
        </motion.div>
        <motion.div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="text-xs text-slate-500 uppercase tracking-wide font-medium">Количество билетов</div>
          <motion.div className="text-2xl font-bold text-slate-800 mt-2">{dashboard.kpi.ticket_count.toLocaleString('ru-RU')}</motion.div>
        </motion.div>
        <motion.div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <motion.div className="text-xs text-slate-500 uppercase tracking-wide font-medium">Количество площадок</motion.div>
          <motion.div className="text-2xl font-bold text-slate-800 mt-2">{dashboard.kpi.site_count.toLocaleString('ru-RU')}</motion.div>
        </motion.div>
      </motion.div>

      <motion.div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <motion.div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2 uppercase tracking-wide">
            <BarChart3 className="h-4 w-4 text-indigo-600" />
            Топ-10 площадок по расходам
          </h3>
          <HBarChart
            data={dashboard.by_podrazdelenie.slice(0, 10) as Array<Record<string, unknown>>}
            labelKey="podrazdelenie"
            valueKey="summa"
            onBarClick={onFilterPodrazdelenie}
          />
        </motion.div>

        <motion.div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wide">Операции</h3>
          <motion.div className="grid grid-cols-2 gap-3 text-sm">
            <motion.div className="p-3 bg-slate-50 rounded-lg">Всего: <b>{dashboard.operations.total.toLocaleString('ru-RU')}</b></motion.div>
            <motion.div className="p-3 bg-emerald-50 rounded-lg">Покупка: <b>{dashboard.operations.pokupka.toLocaleString('ru-RU')}</b></motion.div>
            <motion.div className="p-3 bg-amber-50 rounded-lg">Обмен: <b>{dashboard.operations.obmen.toLocaleString('ru-RU')}</b></motion.div>
            <motion.div className="p-3 bg-red-50 rounded-lg">Возврат+Сбор: <b>{dashboard.operations.vozvrat.toLocaleString('ru-RU')}</b></motion.div>
          </motion.div>
          {carrierPie.length > 0 && (
            <>
              <h4 className="text-xs font-semibold text-slate-600 mt-4 mb-2">Распределение по авиаперевозчикам</h4>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={carrierPie}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    onClick={(d) => onFilterCarrier?.(String((d as { fullName?: string }).fullName ?? ''))}
                    cursor="pointer"
                  >
                    {carrierPie.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatMoneyFull(v) + ' ₽'} />
                </PieChart>
              </ResponsiveContainer>
            </>
          )}
        </motion.div>
      </motion.div>

      <motion.div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <motion.div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wide">Динамика по месяцам</h3>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={timeChart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" fontSize={10} />
              <YAxis yAxisId="left" tickFormatter={(v) => formatMoney(Number(v))} fontSize={10} />
              <YAxis yAxisId="right" orientation="right" fontSize={10} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="summa" name="Сумма ₽" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="tickets" name="Билеты" stroke="#10b981" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <table className="w-full text-xs mt-3 border-t pt-2">
            <thead>
              <tr className="text-slate-500 text-left">
                <th className="py-1">Период</th>
                <th className="py-1">Сумма</th>
                <th className="py-1">Билеты</th>
              </tr>
            </thead>
            <tbody>
              {timeChart.map((t) => (
                <tr key={t.period} className="border-t border-slate-50">
                  <td className="py-1">{t.period}</td>
                  <td className="py-1 font-medium">{formatMoneyFull(t.summa)} ₽</td>
                  <td className="py-1">{t.tickets}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        <motion.div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Обоснование перелётов</h3>
            <select
              value={obosnTop}
              onChange={(e) => setObosnTop(Number(e.target.value) as 5 | 10 | 15)}
              className="h-7 text-xs border rounded px-1"
            >
              <option value={5}>Топ-5</option>
              <option value={10}>Топ-10</option>
              <option value={15}>Топ-15</option>
            </select>
          </div>
          <HBarChart
            data={obosnRows as Array<Record<string, unknown>>}
            labelKey="obosnovanie_pereleta"
            valueKey="summa"
            formatLabel={(v) => shortObosn(v)}
          />
        </motion.div>
      </motion.div>

      <motion.div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {(dashboard.top_marshruty?.length ?? 0) > 0 && (
          <motion.div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wide">Топ-5 дорогих маршрутов</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 text-left border-b">
                  <th className="py-2 pr-2">Маршрут</th>
                  <th className="py-2 pr-2">Поездок</th>
                  <th className="py-2 pr-2">Средняя</th>
                  <th className="py-2">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.top_marshruty!.map((r) => (
                  <tr key={String(r.marshrut)} className="border-b border-slate-50">
                    <td className="py-2 pr-2 truncate max-w-[180px]" title={String(r.marshrut)}>{r.marshrut || '—'}</td>
                    <td className="py-2 pr-2">{r.trips}</td>
                    <td className="py-2 pr-2">{formatMoneyFull(r.avg_cost)} ₽</td>
                    <td className="py-2 font-medium">{formatMoneyFull(r.summa)} ₽</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}

        {(dashboard.top_employees?.length ?? 0) > 0 && (
          <motion.div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wide">Активность по сотрудникам</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 text-left border-b">
                  <th className="py-2 pr-2">ФИО</th>
                  <th className="py-2 pr-2">Поездок</th>
                  <th className="py-2 pr-2">Средняя</th>
                  <th className="py-2">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.top_employees!.slice(0, 10).map((r) => (
                  <tr key={String(r.fio)} className="border-b border-slate-50">
                    <td className="py-2 pr-2 truncate max-w-[160px]" title={String(r.fio)}>{r.fio || '—'}</td>
                    <td className="py-2 pr-2">{r.trips}</td>
                    <td className="py-2 pr-2">{formatMoneyFull(r.avg_cost ?? 0)} ₽</td>
                    <td className="py-2 font-medium">{formatMoneyFull(r.summa)} ₽</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
