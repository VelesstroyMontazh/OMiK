'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useExcelApi } from '@/hooks/use-excel-api'
import FilterableDataTable from '@/components/excel/FilterableDataTable'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  BarChart3,
  Users,
  Plane,
  PlaneTakeoff,
  Filter,
  RefreshCw,
  Loader2,
  TrendingUp,
  TrendingDown,
  Calendar,
  MapPin,
  Building2,
  Briefcase,
  Globe,
  FileSpreadsheet,
  ArrowUpDown,
} from 'lucide-react'

// Types
interface FilterOptions {
  main_db: {
    statuses: string[]
    citizenships: string[]
    territories: string[]
    organizations: string[]
    employment_years: number[]
    dismissal_years: number[]
  }
  calendar: {
    citizenships: string[]
    justifications: string[]
    arrival_statuses: string[]
    directions: string[]
    worker_types: string[]
    departments: string[]
    years: number[]
    months: number[]
  }
}

interface CategoryItem {
  name: string
  count: number
}

interface MonthItem {
  year: number
  month: number | null
  period: string
  count: number
}

interface ReportResult {
  report_type: string
  title: string
  filters_applied: Record<string, unknown>
  total: number
  by_year?: Array<{ year: number; count: number }>
  by_month?: Array<MonthItem>
  by_citizenship?: Array<CategoryItem>
  by_territory?: Array<CategoryItem>
  by_organization?: Array<CategoryItem>
  by_status?: Array<CategoryItem>
  by_department?: Array<CategoryItem>
  by_position?: Array<CategoryItem>
  by_justification?: Array<CategoryItem>
  by_arrival_status?: Array<CategoryItem>
  by_worker_type?: Array<CategoryItem>
  by_ticket_status?: Array<CategoryItem>
  cross_status_citizenship?: Array<{ status: string; citizenship: string; count: number }>
}

function formatNumber(n: number): string {
  return n.toLocaleString('ru-RU')
}

// CSS Bar Chart component
function BarChart({
  data,
  maxValue,
  colorClass = 'bg-amber-500',
  labelKey,
}: {
  data: Array<{ label: string; count: number }>
  maxValue: number
  colorClass?: string
  labelKey?: string
}) {
  if (!data || data.length === 0) return null

  return (
    <div className="space-y-1.5">
      {data.map((item, idx) => {
        const pct = maxValue > 0 ? (item.count / maxValue) * 100 : 0
        return (
          <div key={labelKey ? `${labelKey}-${idx}` : idx} className="flex items-center gap-2">
            <div className="w-28 text-[11px] text-gray-600 truncate text-right flex-shrink-0" title={item.label}>
              {item.label}
            </div>
            <div className="flex-1 h-5 bg-gray-100 rounded-sm overflow-hidden">
              <div
                className={`h-full ${colorClass} rounded-sm transition-all duration-500 min-w-[2px]`}
                style={{ width: `${Math.max(pct, 0.5)}%` }}
              />
            </div>
            <div className="w-16 text-[11px] text-gray-800 font-medium text-right flex-shrink-0">
              {formatNumber(item.count)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Summary card
function SummaryCard({
  title,
  value,
  icon: Icon,
  color = 'text-amber-600',
  bgColor = 'bg-amber-50',
}: {
  title: string
  value: number | string
  icon: React.ElementType
  color?: string
  bgColor?: string
}) {
  return (
    <Card className="py-3 gap-2">
      <CardHeader className="pb-0 pt-0 px-4">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${bgColor}`}>
            <Icon className={`h-4 w-4 ${color}`} />
          </div>
          <CardTitle className="text-[11px] font-medium text-gray-500">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pb-0 px-4">
        <p className="text-2xl font-bold text-gray-900">{typeof value === 'number' ? formatNumber(value) : value}</p>
      </CardContent>
    </Card>
  )
}

// Filter row for a single select
function FilterSelect({
  label,
  placeholder,
  value,
  onValueChange,
  options,
}: {
  label: string
  placeholder: string
  value: string
  onValueChange: (val: string) => void
  options: Array<string | number>
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-[11px] text-gray-500 whitespace-nowrap min-w-[60px]">{label}</label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger size="sm" className="h-7 text-[11px] w-[160px]">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={String(opt)} value={String(opt)}>
              {String(opt)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────
export default function ReportsPanel() {
  const api = useExcelApi()

  // Filter options from backend
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null)
  const [loadingFilters, setLoadingFilters] = useState(true)

  // Active tab
  const [activeTab, setActiveTab] = useState('employment')

  // Report state
  const [reportData, setReportData] = useState<ReportResult | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filter state — Employment / Dismissals / Composition
  const [mainYear, setMainYear] = useState<string>('all')
  const [mainCitizenship, setMainCitizenship] = useState<string>('all')
  const [mainTerritory, setMainTerritory] = useState<string>('all')
  const [mainOrganization, setMainOrganization] = useState<string>('all')
  const [mainStatus, setMainStatus] = useState<string>('all')

  // Filter state — Calendar
  const [calYear, setCalYear] = useState<string>('all')
  const [calMonth, setCalMonth] = useState<string>('all')
  const [calDirection, setCalDirection] = useState<string>('all')
  const [calCitizenship, setCalCitizenship] = useState<string>('all')
  const [calJustification, setCalJustification] = useState<string>('all')
  const [calArrivalStatus, setCalArrivalStatus] = useState<string>('all')
  const [calWorkerType, setCalWorkerType] = useState<string>('all')
  const [calDepartment, setCalDepartment] = useState<string>('all')

  // Calendar loaded?
  const [calendarLoaded, setCalendarLoaded] = useState(false)
  const [loadingCalendar, setLoadingCalendar] = useState(false)

  // Load filter options
  useEffect(() => {
    const load = async () => {
      try {
        setLoadingFilters(true)
        const result = await api.getReportFilters()
        setFilterOptions(result as FilterOptions)
      } catch (err) {
        console.error('Failed to load filters:', err)
      } finally {
        setLoadingFilters(false)
      }
    }
    load()
  }, [api])

  // Check calendar status on mount
  useEffect(() => {
    const check = async () => {
      try {
        const result = await api.calendarStatus()
        setCalendarLoaded(result?.loaded === true)
      } catch {
        setCalendarLoaded(false)
      }
    }
    check()
  }, [api])

  // Load calendar
  const handleLoadCalendar = useCallback(async () => {
    try {
      setLoadingCalendar(true)
      await api.calendarLoad()
      setCalendarLoaded(true)
    } catch (err) {
      console.error('Failed to load calendar:', err)
      setError('Не удалось загрузить календарь')
    } finally {
      setLoadingCalendar(false)
    }
  }, [api])

  // Build params and generate report
  const handleGenerateReport = useCallback(async () => {
    const isCalendar = activeTab === 'calendar'
    const reportTypeMap: Record<string, string> = {
      employment: 'employment_by_period',
      dismissal: 'dismissal_by_period',
      composition: 'current_composition',
      calendar: 'calendar_summary',
    }

    const params: Record<string, unknown> = {
      report_type: reportTypeMap[activeTab] || 'employment_by_period',
    }

    if (isCalendar) {
      if (calYear !== 'all') params.year = Number(calYear)
      if (calMonth !== 'all') params.month = Number(calMonth)
      if (calDirection !== 'all') params.direction = calDirection
      if (calCitizenship !== 'all') params.citizenship = calCitizenship
      if (calJustification !== 'all') params.justification = calJustification
      if (calArrivalStatus !== 'all') params.arrival_status = calArrivalStatus
      if (calWorkerType !== 'all') params.worker_type = calWorkerType
      if (calDepartment !== 'all') params.department = calDepartment
    } else {
      if (mainYear !== 'all') params.year = Number(mainYear)
      if (mainCitizenship !== 'all') params.citizenship = mainCitizenship
      if (mainTerritory !== 'all') params.territory = mainTerritory
      if (mainOrganization !== 'all') params.organization = mainOrganization
      if (mainStatus !== 'all') params.status = mainStatus
    }

    try {
      setLoadingReport(true)
      setError(null)
      const result = await api.generateReport(params as Parameters<typeof api.generateReport>[0])
      setReportData(result as ReportResult)
    } catch (err) {
      console.error('Failed to generate report:', err)
      setError('Ошибка при генерации отчёта. Попробуйте снова.')
    } finally {
      setLoadingReport(false)
    }
  }, [activeTab, mainYear, mainCitizenship, mainTerritory, mainOrganization, mainStatus, calYear, calMonth, calDirection, calCitizenship, calJustification, calArrivalStatus, calWorkerType, calDepartment, api])

  // Reset filters
  const handleResetFilters = useCallback(() => {
    if (activeTab === 'calendar') {
      setCalYear('all')
      setCalMonth('all')
      setCalDirection('all')
      setCalCitizenship('all')
      setCalJustification('all')
      setCalArrivalStatus('all')
      setCalWorkerType('all')
      setCalDepartment('all')
    } else {
      setMainYear('all')
      setMainCitizenship('all')
      setMainTerritory('all')
      setMainOrganization('all')
      setMainStatus('all')
    }
    setReportData(null)
    setError(null)
  }, [activeTab])

  // Reset when tab changes
  const handleTabChange = useCallback((val: string) => {
    setActiveTab(val)
    setReportData(null)
    setError(null)
  }, [])

  // ─── Render helpers ─────────────────────────────────────────────
  const renderMainFilters = () => (
    <div className="flex flex-wrap items-end gap-3">
      <FilterSelect
        label="Год"
        placeholder="Все годы"
        value={mainYear}
        onValueChange={setMainYear}
        options={['all', ...(filterOptions?.main_db?.employment_years || []).map(String)]}
      />
      <FilterSelect
        label="Гражданство"
        placeholder="Все"
        value={mainCitizenship}
        onValueChange={setMainCitizenship}
        options={['all', ...(filterOptions?.main_db?.citizenships || [])]}
      />
      <FilterSelect
        label="Территория"
        placeholder="Все"
        value={mainTerritory}
        onValueChange={setMainTerritory}
        options={['all', ...(filterOptions?.main_db?.territories || [])]}
      />
      <FilterSelect
        label="Организация"
        placeholder="Все"
        value={mainOrganization}
        onValueChange={setMainOrganization}
        options={['all', ...(filterOptions?.main_db?.organizations || [])]}
      />
      <FilterSelect
        label="Состояние"
        placeholder="Все"
        value={mainStatus}
        onValueChange={setMainStatus}
        options={['all', ...(filterOptions?.main_db?.statuses || [])]}
      />
      <Button
        size="sm"
        className="h-7 bg-amber-600 hover:bg-amber-700 text-white text-[11px]"
        onClick={handleGenerateReport}
        disabled={loadingReport}
      >
        {loadingReport ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <BarChart3 className="h-3.5 w-3.5 mr-1" />}
        Сформировать
      </Button>
      <Button variant="ghost" size="sm" className="h-7 text-[11px] text-gray-500" onClick={handleResetFilters}>
        <RefreshCw className="h-3 w-3 mr-1" />
        Сбросить
      </Button>
    </div>
  )

  const renderCalendarFilters = () => (
    <div className="flex flex-wrap items-end gap-3">
      <FilterSelect
        label="Год"
        placeholder="Все годы"
        value={calYear}
        onValueChange={setCalYear}
        options={['all', ...(filterOptions?.calendar?.years || []).map(String)]}
      />
      <FilterSelect
        label="Месяц"
        placeholder="Все"
        value={calMonth}
        onValueChange={setCalMonth}
        options={['all', ...(filterOptions?.calendar?.months || []).map(String)]}
      />
      <FilterSelect
        label="Направление"
        placeholder="Все"
        value={calDirection}
        onValueChange={setCalDirection}
        options={['all', ...(filterOptions?.calendar?.directions || [])]}
      />
      <FilterSelect
        label="Гражданство"
        placeholder="Все"
        value={calCitizenship}
        onValueChange={setCalCitizenship}
        options={['all', ...(filterOptions?.calendar?.citizenships || [])]}
      />
      <FilterSelect
        label="Обоснование"
        placeholder="Все"
        value={calJustification}
        onValueChange={setCalJustification}
        options={['all', ...(filterOptions?.calendar?.justifications || [])]}
      />
      <FilterSelect
        label="Статус"
        placeholder="Все"
        value={calArrivalStatus}
        onValueChange={setCalArrivalStatus}
        options={['all', ...(filterOptions?.calendar?.arrival_statuses || [])]}
      />
      <FilterSelect
        label="Тип"
        placeholder="Все"
        value={calWorkerType}
        onValueChange={setCalWorkerType}
        options={['all', ...(filterOptions?.calendar?.worker_types || [])]}
      />
      <FilterSelect
        label="Подразд."
        placeholder="Все"
        value={calDepartment}
        onValueChange={setCalDepartment}
        options={['all', ...(filterOptions?.calendar?.departments || [])]}
      />
      <Button
        size="sm"
        className="h-7 bg-amber-600 hover:bg-amber-700 text-white text-[11px]"
        onClick={handleGenerateReport}
        disabled={loadingReport || !calendarLoaded}
      >
        {loadingReport ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <BarChart3 className="h-3.5 w-3.5 mr-1" />}
        Сформировать
      </Button>
      <Button variant="ghost" size="sm" className="h-7 text-[11px] text-gray-500" onClick={handleResetFilters}>
        <RefreshCw className="h-3 w-3 mr-1" />
        Сбросить
      </Button>
    </div>
  )

  // Summary cards for Employment tab
  const renderEmploymentSummary = () => {
    if (!reportData) return null
    const topCitizenship = reportData.by_citizenship?.[0]
    const topYear = reportData.by_year?.reduce((a, b) => b.count > a.count ? b : a, reportData.by_year![0])
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          title="Всего трудоустроено"
          value={reportData.total}
          icon={TrendingUp}
          color="text-emerald-600"
          bgColor="bg-emerald-50"
        />
        {topYear && (
          <SummaryCard
            title={`Пик ${topYear.year} г.`}
            value={topYear.count}
            icon={Calendar}
            color="text-amber-600"
            bgColor="bg-amber-50"
          />
        )}
        {topCitizenship && (
          <SummaryCard
            title={topCitizenship.name}
            value={topCitizenship.count}
            icon={Globe}
            color="text-blue-600"
            bgColor="bg-blue-50"
          />
        )}
        {(reportData.by_territory?.length ?? 0) > 0 && (
          <SummaryCard
            title="Территорий"
            value={reportData.by_territory!.length}
            icon={MapPin}
            color="text-purple-600"
            bgColor="bg-purple-50"
          />
        )}
      </div>
    )
  }

  // Summary cards for Dismissal tab
  const renderDismissalSummary = () => {
    if (!reportData) return null
    const topCitizenship = reportData.by_citizenship?.[0]
    const topYear = reportData.by_year?.[0]
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          title="Всего уволено"
          value={reportData.total}
          icon={TrendingDown}
          color="text-red-600"
          bgColor="bg-red-50"
        />
        {topYear && (
          <SummaryCard
            title={`За ${topYear.year} год`}
            value={topYear.count}
            icon={Calendar}
            color="text-amber-600"
            bgColor="bg-amber-50"
          />
        )}
        {topCitizenship && (
          <SummaryCard
            title={topCitizenship.name}
            value={topCitizenship.count}
            icon={Globe}
            color="text-blue-600"
            bgColor="bg-blue-50"
          />
        )}
        {(reportData.by_organization?.length ?? 0) > 0 && (
          <SummaryCard
            title="Организаций"
            value={reportData.by_organization!.length}
            icon={Building2}
            color="text-orange-600"
            bgColor="bg-orange-50"
          />
        )}
      </div>
    )
  }

  // Summary cards for Composition tab
  const renderCompositionSummary = () => {
    if (!reportData) return null
    const topStatus = reportData.by_status?.[0]
    const topCitizenship = reportData.by_citizenship?.[0]
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          title="Всего сотрудников"
          value={reportData.total}
          icon={Users}
          color="text-amber-600"
          bgColor="bg-amber-50"
        />
        {topStatus && (
          <SummaryCard
            title={topStatus.name}
            value={topStatus.count}
            icon={TrendingUp}
            color="text-emerald-600"
            bgColor="bg-emerald-50"
          />
        )}
        {topCitizenship && (
          <SummaryCard
            title={topCitizenship.name}
            value={topCitizenship.count}
            icon={Globe}
            color="text-blue-600"
            bgColor="bg-blue-50"
          />
        )}
        {(reportData.by_organization?.length ?? 0) > 0 && (
          <SummaryCard
            title="Организаций"
            value={reportData.by_organization!.length}
            icon={Building2}
            color="text-orange-600"
            bgColor="bg-orange-50"
          />
        )}
      </div>
    )
  }

  // Summary cards for Calendar tab
  const renderCalendarSummary = () => {
    if (!reportData) return null
    const topJustification = reportData.by_justification?.[0]
    const topCitizenship = reportData.by_citizenship?.[0]
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          title="Всего записей"
          value={reportData.total}
          icon={Plane}
          color="text-amber-600"
          bgColor="bg-amber-50"
        />
        {topJustification && (
          <SummaryCard
            title={topJustification.name}
            value={topJustification.count}
            icon={Filter}
            color="text-sky-600"
            bgColor="bg-sky-50"
          />
        )}
        {topCitizenship && (
          <SummaryCard
            title={topCitizenship.name}
            value={topCitizenship.count}
            icon={Globe}
            color="text-purple-600"
            bgColor="bg-purple-50"
          />
        )}
        {(reportData.by_arrival_status?.length ?? 0) > 0 && (
          <SummaryCard
            title="Статусов"
            value={reportData.by_arrival_status!.length}
            icon={PlaneTakeoff}
            color="text-blue-600"
            bgColor="bg-blue-50"
          />
        )}
      </div>
    )
  }

  // Chart section
  const renderChartSection = (
    title: string,
    data: Array<{ label: string; count: number }> | undefined,
    colorClass: string,
    icon: React.ElementType
  ) => {
    if (!data || data.length === 0) return null
    const maxVal = Math.max(...data.map((d) => d.count))
    const Icon = icon
    return (
      <Card className="py-3 gap-2">
        <CardHeader className="pb-0 pt-0 px-4">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-amber-600" />
            <CardTitle className="text-sm font-semibold text-gray-700">{title}</CardTitle>
            <Badge variant="secondary" className="text-[10px] ml-auto">{data.length} записей</Badge>
          </div>
        </CardHeader>
        <CardContent className="pb-0 px-4">
          <BarChart data={data.slice(0, 15)} maxValue={maxVal} colorClass={colorClass} labelKey={title} />
          {data.length > 15 && (
            <p className="text-[10px] text-gray-400 mt-1 text-center">
              Показано топ-15 из {data.length}
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  // Data table section
  const renderDataTable = (
    title: string,
    data: Array<Record<string, unknown>> | undefined,
    labelKey: string,
    valueKey: string
  ) => {
    if (!data || data.length === 0) return null
    const maxVal = Math.max(...data.map((d) => Number(d[valueKey]) || 0))
    const rows = data.map((item) => {
      const count = Number(item[valueKey]) || 0
      const pct = maxVal > 0 ? (count / (reportData?.total || maxVal)) * 100 : 0
      return {
        name: String(item[labelKey] ?? ''),
        count: formatNumber(count),
        pct: `${pct.toFixed(1)}%`,
      }
    })
    return (
      <Card className="py-3 gap-2 overflow-hidden">
        <CardHeader className="pb-0 pt-0 px-4">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-amber-600" />
            <CardTitle className="text-sm font-semibold text-gray-700">{title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pb-0 px-0">
          <FilterableDataTable
            columns={[
              { key: 'name', title: 'Наименование' },
              { key: 'count', title: 'Кол-во' },
              { key: 'pct', title: 'Доля' },
            ]}
            rows={rows}
            editTitle={title}
            maxHeight="max-h-64"
            headerVariant="amber"
          />
        </CardContent>
      </Card>
    )
  }

  // Report results
  const renderEmploymentResults = () => {
    if (!reportData) return <EmptyReportPlaceholder />
    return (
      <div className="space-y-4">
        {renderEmploymentSummary()}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {renderChartSection('По годам', reportData.by_year?.map(d => ({ label: String(d.year), count: d.count })), 'bg-amber-500', Calendar)}
          {renderChartSection('По гражданству', reportData.by_citizenship?.map(d => ({ label: d.name, count: d.count })), 'bg-emerald-500', Globe)}
          {renderChartSection('По территории', reportData.by_territory?.map(d => ({ label: d.name, count: d.count })), 'bg-sky-500', MapPin)}
          {renderChartSection('По организации', reportData.by_organization?.map(d => ({ label: d.name, count: d.count })), 'bg-purple-500', Building2)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {renderDataTable('Таблица: По гражданству', reportData.by_citizenship as Array<Record<string, unknown>> | undefined, 'name', 'count')}
          {renderDataTable('Таблица: По территории', reportData.by_territory as Array<Record<string, unknown>> | undefined, 'name', 'count')}
        </div>
      </div>
    )
  }

  const renderDismissalResults = () => {
    if (!reportData) return <EmptyReportPlaceholder />
    return (
      <div className="space-y-4">
        {renderDismissalSummary()}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {renderChartSection('По годам', reportData.by_year?.map(d => ({ label: String(d.year), count: d.count })), 'bg-red-400', Calendar)}
          {renderChartSection('По гражданству', reportData.by_citizenship?.map(d => ({ label: d.name, count: d.count })), 'bg-orange-500', Globe)}
          {renderChartSection('По организации', reportData.by_organization?.map(d => ({ label: d.name, count: d.count })), 'bg-purple-500', Building2)}
          {renderChartSection('По должности', reportData.by_position?.map(d => ({ label: d.name, count: d.count })), 'bg-rose-500', Briefcase)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {renderDataTable('Таблица: По гражданству', reportData.by_citizenship as Array<Record<string, unknown>> | undefined, 'name', 'count')}
          {renderDataTable('Таблица: По организации', reportData.by_organization as Array<Record<string, unknown>> | undefined, 'name', 'count')}
        </div>
      </div>
    )
  }

  const renderCompositionResults = () => {
    if (!reportData) return <EmptyReportPlaceholder />
    return (
      <div className="space-y-4">
        {renderCompositionSummary()}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {renderChartSection('По статусу', reportData.by_status?.map(d => ({ label: d.name, count: d.count })), 'bg-amber-500', Users)}
          {renderChartSection('По гражданству', reportData.by_citizenship?.map(d => ({ label: d.name, count: d.count })), 'bg-emerald-500', Globe)}
          {renderChartSection('По территории', reportData.by_territory?.map(d => ({ label: d.name, count: d.count })), 'bg-sky-500', MapPin)}
          {renderChartSection('По организации', reportData.by_organization?.map(d => ({ label: d.name, count: d.count })), 'bg-purple-500', Building2)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {renderDataTable('Таблица: По статусу', reportData.by_status as Array<Record<string, unknown>> | undefined, 'name', 'count')}
          {renderDataTable('Таблица: По подразделению', reportData.by_department as Array<Record<string, unknown>> | undefined, 'name', 'count')}
        </div>
      </div>
    )
  }

  const renderCalendarResults = () => {
    if (!calendarLoaded) {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <FileSpreadsheet className="h-12 w-12 text-gray-300 mb-4" />
          <p className="text-gray-500 mb-4">Календарь Прилет/Вылет не загружен</p>
          <Button
            className="bg-amber-600 hover:bg-amber-700 text-white"
            onClick={handleLoadCalendar}
            disabled={loadingCalendar}
          >
            {loadingCalendar ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plane className="h-4 w-4 mr-2" />}
            Загрузить календарь
          </Button>
        </div>
      )
    }
    if (!reportData) return <EmptyReportPlaceholder />
    return (
      <div className="space-y-4">
        {renderCalendarSummary()}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {renderChartSection('По обоснованию', reportData.by_justification?.map(d => ({ label: d.name, count: d.count })), 'bg-sky-500', Plane)}
          {renderChartSection('По месяцам', reportData.by_month?.map(d => ({ label: `${d.year || ''}-${String(d.month || '').padStart(2, '0')}`, count: d.count })), 'bg-amber-500', Calendar)}
          {renderChartSection('По гражданству', reportData.by_citizenship?.map(d => ({ label: d.name, count: d.count })), 'bg-emerald-500', Globe)}
          {renderChartSection('По статусу прибытия', reportData.by_arrival_status?.map(d => ({ label: d.name, count: d.count })), 'bg-purple-500', Filter)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {renderDataTable('Таблица: По обоснованию', reportData.by_justification as Array<Record<string, unknown>> | undefined, 'name', 'count')}
          {renderDataTable('Таблица: По статусу прибытия', reportData.by_arrival_status as Array<Record<string, unknown>> | undefined, 'name', 'count')}
        </div>
      </div>
    )
  }

  // ─── Main render ──────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gradient-to-b from-amber-50/50 to-white">
      {/* Loading filters overlay */}
      {loadingFilters && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-100">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />
          <span className="text-[11px] text-amber-700">Загрузка параметров фильтров...</span>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col">
        {/* Tab bar */}
        <div className="border-b border-gray-200 bg-white px-4 pt-3">
          <TabsList className="bg-gray-100">
            <TabsTrigger value="employment" className="text-[11px] gap-1.5 data-[state=active]:bg-amber-50 data-[state=active]:text-amber-800">
              <TrendingUp className="h-3.5 w-3.5" />
              Трудоустройство
            </TabsTrigger>
            <TabsTrigger value="dismissal" className="text-[11px] gap-1.5 data-[state=active]:bg-red-50 data-[state=active]:text-red-800">
              <TrendingDown className="h-3.5 w-3.5" />
              Увольнения
            </TabsTrigger>
            <TabsTrigger value="composition" className="text-[11px] gap-1.5 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-800">
              <Users className="h-3.5 w-3.5" />
              Состав
            </TabsTrigger>
            <TabsTrigger value="calendar" className="text-[11px] gap-1.5 data-[state=active]:bg-sky-50 data-[state=active]:text-sky-800">
              <Plane className="h-3.5 w-3.5" />
              Календарь
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Filter panel */}
        <div className="border-b border-gray-200 px-4 py-3 bg-white flex-shrink-0">
          {activeTab === 'calendar' ? renderCalendarFilters() : renderMainFilters()}
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-2 bg-red-50 border-b border-red-100 text-[11px] text-red-600 flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <TabsContent value="employment" className="mt-0">
            {loadingReport ? <LoadingSpinner /> : renderEmploymentResults()}
          </TabsContent>
          <TabsContent value="dismissal" className="mt-0">
            {loadingReport ? <LoadingSpinner /> : renderDismissalResults()}
          </TabsContent>
          <TabsContent value="composition" className="mt-0">
            {loadingReport ? <LoadingSpinner /> : renderCompositionResults()}
          </TabsContent>
          <TabsContent value="calendar" className="mt-0">
            {loadingReport ? <LoadingSpinner /> : renderCalendarResults()}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

// Helper components
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      <span className="ml-3 text-sm text-gray-500">Формирование отчёта...</span>
    </div>
  )
}

function EmptyReportPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <BarChart3 className="h-12 w-12 text-gray-300 mb-4" />
      <p className="text-gray-500 text-sm">Выберите параметры и нажмите «Сформировать»</p>
      <p className="text-gray-400 text-[11px] mt-1">Для генерации отчёта укажите фильтры</p>
    </div>
  )
}
