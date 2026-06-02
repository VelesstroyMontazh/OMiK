'use client'

import React, { useCallback, useState } from 'react'
import { useExcelApi } from '@/hooks/use-excel-api'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Download, FileSpreadsheet, Loader2, Wand2 } from 'lucide-react'
import PathInputWithBrowse from '@/components/excel/PathInputWithBrowse'

export default function FilePreparePanel() {
  const api = useExcelApi()
  const [filePath, setFilePath] = useState('')
  const [outputName, setOutputName] = useState('')
  const [saveInPlace, setSaveInPlace] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    file_id: string
    stored_filename: string
    sheets_processed: number
    formulas_replaced: number
    filters_removed: number
    dimensions_unhidden: number
    saved_in_place?: boolean
  } | null>(null)

  const handleProcess = useCallback(async () => {
    const path = filePath.trim()
    if (!path) {
      setError('Укажите путь к файлу Excel (.xlsx / .xlsm)')
      return
    }
    setError(null)
    setResult(null)
    setProcessing(true)
    try {
      const data = await api.prepareExcelFile({
        file_path: path,
        output_name: outputName.trim() || undefined,
        save_in_place: saveInPlace,
      })
      setResult({
        file_id: data.file_id,
        stored_filename: data.stored_filename,
        sheets_processed: data.sheets_processed ?? 0,
        formulas_replaced: data.formulas_replaced ?? 0,
        filters_removed: data.filters_removed ?? 0,
        dimensions_unhidden: data.dimensions_unhidden ?? 0,
        saved_in_place: data.saved_in_place,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка обработки файла')
    } finally {
      setProcessing(false)
    }
  }, [api, filePath, outputName, saveInPlace])

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gradient-to-b from-violet-50/40 to-white">
      <div className="border-b border-gray-200 bg-white px-4 py-3 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow">
            <Wand2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-800">Подготовка файла Excel</h2>
            <p className="text-[11px] text-gray-500">
              Видимые листы • раскрытые строки/столбцы • без фильтров • формулы → значения
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PathInputWithBrowse
            value={filePath}
            onChange={setFilePath}
            mode="file"
            placeholder="Полный путь к файлу (.xlsx, .xlsm)"
            inputClassName="h-8 flex-1 min-w-[320px] rounded border border-gray-300 px-2 text-xs"
          />
          <input
            value={outputName}
            onChange={(e) => setOutputName(e.target.value)}
            className="h-8 w-[220px] rounded border border-gray-300 px-2 text-xs"
            placeholder="Имя результата (необязательно)"
          />
          <label className="flex items-center gap-1.5 text-[11px] text-gray-600">
            <input
              type="checkbox"
              checked={saveInPlace}
              onChange={(e) => setSaveInPlace(e.target.checked)}
              className="rounded"
            />
            Перезаписать исходный файл
          </label>
          <Button size="sm" onClick={() => void handleProcess()} disabled={processing}>
            {processing ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5 mr-1" />
            )}
            Обработать
          </Button>
        </div>

        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
            {error}
          </div>
        )}

        {result && (
          <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-2 flex flex-wrap items-center gap-2">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            <span>
              {result.saved_in_place ? 'Файл перезаписан' : result.stored_filename}: листов{' '}
              {result.sheets_processed}, формул заменено {result.formulas_replaced.toLocaleString('ru-RU')}
              , фильтров снято {result.filters_removed}, раскрыто скрытых строк/столбцов{' '}
              {result.dimensions_unhidden.toLocaleString('ru-RU')}
            </span>
            {!result.saved_in_place && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 ml-auto"
                onClick={() => void api.downloadFile(result.file_id)}
              >
                <Download className="h-3 w-3 mr-1" />
                Скачать
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 p-6 text-sm text-gray-600 space-y-3 max-w-3xl">
        <p className="flex items-start gap-2">
          <FileSpreadsheet className="h-4 w-4 mt-0.5 text-violet-600 flex-shrink-0" />
          Укажите путь к книге Excel и нажмите <strong>Обработать</strong>. На каждом листе будет выполнено:
        </p>
        <ul className="list-disc pl-8 space-y-1 text-[13px]">
          <li>все листы станут <strong>видимыми</strong> (включая скрытые);</li>
          <li>сняты <strong>автофильтры</strong>;</li>
          <li>раскрыты скрытые <strong>строки и столбцы</strong>;</li>
          <li>все <strong>формулы заменены на значения</strong> (как «Специальная вставка → Значения»).</li>
        </ul>
        <p className="text-[11px] text-gray-400">
          Поддерживаются форматы .xlsx и .xlsm. Большие книги (.xlsm) могут обрабатываться 5–30 минут — не закрывайте
          вкладку. Убедитесь, что запущен excel-service:{' '}
          <code className="text-[10px]">cd mini-services/excel-service &amp;&amp; python app.py</code>
        </p>
      </div>
    </div>
  )
}
