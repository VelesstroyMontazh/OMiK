import { apiUrl } from '@/hooks/excel-api/http'
import type { AnalysisResult, MacroResult } from '@/hooks/excel-api/types'

export function createMacroApi() {
  const executeMacro = async (
    filePath: string,
    macroCode: string,
    language: 'vba' | 'python',
  ): Promise<MacroResult> => {
    const response = await fetch(apiUrl('/macro'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: filePath, macro_code: macroCode, language }),
    })
    const data = await response.json()
    if (!response.ok) {
      return {
        success: false,
        output: [],
        errors: [data.detail || 'Ошибка выполнения макроса'],
      }
    }
    return data
  }

  const analyzeData = async (
    filePath: string,
    sheetName: string,
    range: string,
    operations: string[],
  ): Promise<AnalysisResult> => {
    const response = await fetch(apiUrl('/analyze'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_path: filePath,
        sheet_name: sheetName,
        range,
        operations,
      }),
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Ошибка анализа данных' }))
      throw new Error(error.detail || 'Ошибка анализа данных')
    }
    return response.json()
  }

  return { executeMacro, analyzeData }
}
