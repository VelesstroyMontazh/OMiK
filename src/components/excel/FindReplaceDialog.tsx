'use client'

import React, { useCallback, useState } from 'react'
import { useExcelStore } from '@/store/excel-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { X, Search, Replace, ChevronDown, ChevronUp } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

interface FindResult {
  row: number
  col: number
  value: string
}

export default function FindReplaceDialog() {
  const { findReplaceOpen, setFindReplaceOpen, sheets, activeSheetIndex } = useExcelStore()

  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [matchCase, setMatchCase] = useState(false)
  const [matchEntireCell, setMatchEntireCell] = useState(false)
  const [results, setResults] = useState<FindResult[]>([])
  const [currentResultIndex, setCurrentResultIndex] = useState(-1)
  const [showReplace, setShowReplace] = useState(false)

  const sheet = sheets[activeSheetIndex]

  const find = useCallback(
    (findAll = false) => {
      if (!findText) {
        setResults([])
        setCurrentResultIndex(-1)
        return
      }

      const found: FindResult[] = []
      for (const [key, cell] of Object.entries(sheet.data)) {
        const cellValue = String(cell.value ?? '')
        let match = false

        if (matchEntireCell) {
          match = matchCase ? cellValue === findText : cellValue.toLowerCase() === findText.toLowerCase()
        } else {
          match = matchCase
            ? cellValue.includes(findText)
            : cellValue.toLowerCase().includes(findText.toLowerCase())
        }

        if (match) {
          const [row, col] = key.split(',').map(Number)
          found.push({ row, col, value: cellValue })
        }
      }

      setResults(found)
      if (found.length > 0) {
        const newIndex = findAll ? 0 : currentResultIndex < found.length - 1 ? currentResultIndex + 1 : 0
        setCurrentResultIndex(newIndex)
        useExcelStore.getState().setSelectedCell(found[newIndex].row, found[newIndex].col)
      } else {
        setCurrentResultIndex(-1)
      }
    },
    [findText, matchCase, matchEntireCell, sheet.data, currentResultIndex]
  )

  const findNext = useCallback(() => {
    if (results.length === 0) {
      find(false)
      return
    }
    const newIndex = currentResultIndex < results.length - 1 ? currentResultIndex + 1 : 0
    setCurrentResultIndex(newIndex)
    useExcelStore.getState().setSelectedCell(results[newIndex].row, results[newIndex].col)
  }, [results, currentResultIndex, find])

  const findPrev = useCallback(() => {
    if (results.length === 0) return
    const newIndex = currentResultIndex > 0 ? currentResultIndex - 1 : results.length - 1
    setCurrentResultIndex(newIndex)
    useExcelStore.getState().setSelectedCell(results[newIndex].row, results[newIndex].col)
  }, [results, currentResultIndex])

  const handleReplace = useCallback(() => {
    if (currentResultIndex >= 0 && currentResultIndex < results.length) {
      const result = results[currentResultIndex]
      useExcelStore.getState().setCellValue(result.row, result.col, replaceText)
      findNext()
    }
  }, [currentResultIndex, results, replaceText, findNext])

  const handleReplaceAll = useCallback(() => {
    for (const result of results) {
      useExcelStore.getState().setCellValue(result.row, result.col, replaceText)
    }
    setResults([])
    setCurrentResultIndex(-1)
  }, [results, replaceText])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        findNext()
      } else if (e.key === 'Escape') {
        setFindReplaceOpen(false)
      }
    },
    [findNext, setFindReplaceOpen]
  )

  if (!findReplaceOpen) return null

  return (
    <div className="fixed top-16 right-4 z-50 bg-white rounded-lg shadow-xl border border-gray-200 w-[420px]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            {showReplace ? 'Найти и заменить' : 'Найти'}
          </span>
          {results.length > 0 && (
            <span className="text-xs text-gray-500">
              {currentResultIndex + 1} из {results.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={() => setShowReplace(!showReplace)}
          >
            {showReplace ? 'Скрыть замену' : 'Заменить'}
          </Button>
          <button
            className="p-1 rounded hover:bg-gray-100 text-gray-500"
            onClick={() => setFindReplaceOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Find input */}
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Input
            className="h-8 text-sm"
            placeholder="Найти..."
            value={findText}
            onChange={(e) => setFindText(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={findPrev} disabled={results.length === 0}>
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={findNext}>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>

        {/* Replace input */}
        {showReplace && (
          <div className="flex items-center gap-2">
            <Input
              className="h-8 text-sm"
              placeholder="Заменить на..."
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
        )}

        {/* Options */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="matchCase"
              checked={matchCase}
              onCheckedChange={(checked) => setMatchCase(checked === true)}
            />
            <Label htmlFor="matchCase" className="text-xs text-gray-600 cursor-pointer">
              Учитывать регистр
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="matchEntire"
              checked={matchEntireCell}
              onCheckedChange={(checked) => setMatchEntireCell(checked === true)}
            />
            <Label htmlFor="matchEntire" className="text-xs text-gray-600 cursor-pointer">
              Ячейка целиком
            </Label>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => find(true)}
            disabled={!findText}
          >
            <Search className="h-3 w-3 mr-1" />
            Найти все
          </Button>
          {showReplace && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={handleReplace}
                disabled={currentResultIndex < 0 || !replaceText}
              >
                <Replace className="h-3 w-3 mr-1" />
                Заменить
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={handleReplaceAll}
                disabled={results.length === 0 || !replaceText}
              >
                Заменить все
              </Button>
            </>
          )}
        </div>

        {/* Results */}
        {results.length > 0 && (
          <ScrollArea className="h-32 border border-gray-200 rounded">
            <div className="p-1">
              {results.map((result, i) => (
                <div
                  key={`${result.row},${result.col}`}
                  className={`px-2 py-1 text-xs cursor-pointer rounded ${
                    i === currentResultIndex ? 'bg-green-100 text-green-900' : 'hover:bg-gray-50 text-gray-600'
                  }`}
                  onClick={() => {
                    setCurrentResultIndex(i)
                    useExcelStore.getState().setSelectedCell(result.row, result.col)
                  }}
                >
                  <span className="font-mono font-medium">
                    {String.fromCharCode(65 + result.col)}
                    {result.row + 1}
                  </span>
                  : {result.value.substring(0, 50)}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}