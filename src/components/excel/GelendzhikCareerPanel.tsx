'use client'

import React, { useCallback, useState } from 'react'
import { useExcelApi } from '@/hooks/use-excel-api'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Download, Loader2, MapPin, Route } from 'lucide-react'
import PathInputWithBrowse from '@/components/excel/PathInputWithBrowse'

const DEFAULT_SITE = '004 (Геленджик Марина (ВСМ))'
const DEFAULT_AUX_PATH = 'C:\\Otchet_OP_Marina\\Геленджик.xlsx'

export default function GelendzhikCareerPanel() {
  const api = useExcelApi()
  const [gelendzhikPath, setGelendzhikPath] = useState(DEFAULT_AUX_PATH)
  const [siteTerritory, setSiteTerritory] = useState(DEFAULT_SITE)
  const [outputName, setOutputName] = useState('Отчет_Геленджик_путь_сотрудника.xlsx')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    file_id: string
    stored_filename: string
    employees_count: number
    movement_events_count: number
    base_periods_count: number
    transfer_events_count: number
  } | null>(null)

  const handleGenerate = useCallback(async () => {
    setError(null)
    setResult(null)
    setProcessing(true)
    try {
      const data = await api.generateGelendzhikCareerReport({
        gelendzhik_file_path: gelendzhikPath.trim() || undefined,
        site_territory: siteTerritory.trim() || DEFAULT_SITE,
        output_name: outputName.trim() || undefined,
      })
      setResult({
        file_id: data.file_id,
        stored_filename: data.stored_filename,
        employees_count: data.employees_count ?? 0,
        movement_events_count: data.movement_events_count ?? 0,
        base_periods_count: data.base_periods_count ?? 0,
        transfer_events_count: data.transfer_events_count ?? 0,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка формирования отчёта')
    } finally {
      setProcessing(false)
    }
  }, [api, gelendzhikPath, siteTerritory, outputName])

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gradient-to-b from-teal-50/40 to-white">
      <div className="border-b border-gray-200 bg-white px-4 py-3 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow">
            <Route className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-800">Путь сотрудника — Геленджик (ВСМ)</h2>
            <p className="text-[11px] text-gray-500">
              Полная история трудоустройства и переводов для площадки 004 (учёт повторных приёмов по ФИО + дата
              рождения)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PathInputWithBrowse
            value={gelendzhikPath}
            onChange={setGelendzhikPath}
            mode="file"
            placeholder="Путь к Геленджик.xlsx"
            inputClassName="h-8 flex-1 min-w-[280px] rounded border border-gray-300 px-2 text-xs"
          />
          <input
            value={siteTerritory}
            onChange={(e) => setSiteTerritory(e.target.value)}
            className="h-8 w-[300px] rounded border border-gray-300 px-2 text-xs"
            placeholder="Площадка (Территория)"
          />
          <input
            value={outputName}
            onChange={(e) => setOutputName(e.target.value)}
            className="h-8 w-[240px] rounded border border-gray-300 px-2 text-xs"
            placeholder="Имя файла отчёта"
          />
          <Button size="sm" onClick={() => void handleGenerate()} disabled={processing}>
            {processing ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <MapPin className="h-3.5 w-3.5 mr-1" />
            )}
            Сформировать отчёт
          </Button>
        </div>

        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">{error}</div>
        )}

        {result && (
          <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-2 flex flex-wrap items-center gap-2">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            <span>
              {result.stored_filename}: сотрудников {result.employees_count.toLocaleString('ru-RU')}, периодов в базе{' '}
              {result.base_periods_count.toLocaleString('ru-RU')}, событий в ленте{' '}
              {result.movement_events_count.toLocaleString('ru-RU')} (переводов{' '}
              {result.transfer_events_count.toLocaleString('ru-RU')})
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 ml-auto"
              onClick={() => void api.downloadFile(result.file_id)}
            >
              <Download className="h-3 w-3 mr-1" />
              Скачать Excel
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 p-6 text-sm text-gray-600 space-y-3 max-w-3xl">
        <p>
          Отчёт строится по <strong>основной БД</strong> (все периоды работы сотрудника) и файлу{' '}
          <strong>Геленджик.xlsx</strong>:
        </p>
        <ul className="list-disc pl-8 space-y-1 text-[13px]">
          <li>
            <strong>прием</strong> и <strong>На Геленджик</strong> — строки, где «Территория после» = площадка 004;
          </li>
          <li>
            <strong>с Геленджик</strong> — строки, где «Территория до» = площадка 004;
          </li>
          <li>
            в отчёт попадают сотрудники, которые хотя бы раз были на этой площадке (по базе или по файлу переводов);
          </li>
          <li>
            для каждого показывается <strong>весь путь</strong> по всем территориям из базы + переводы по датам.
          </li>
        </ul>
        <p className="text-[11px] text-gray-400">
          Листы: «Путь сотрудника» (Тип события1, Дата события1, Тип события2, …), «График присутствия» (1/0 по дням на
          площадке с 01.09.2024), «Сводка», «Периоды в базе», прием / На Геленджик / с Геленджик.
        </p>
      </div>
    </div>
  )
}
