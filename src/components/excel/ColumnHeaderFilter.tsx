'use client'

import React, { useMemo, useState } from 'react'
import { Filter } from 'lucide-react'

export default function ColumnHeaderFilter({
  colKey,
  title,
  activeFilter,
  isOpen,
  uniqueValues,
  selected,
  onToggleOpen,
  onToggleValue,
  onClear,
  onSelectAll,
  onSelectNone,
  maxOptions = 200,
  titleClassName = 'truncate max-w-[140px]',
  variant = 'indigo',
}: {
  colKey: string
  title: string
  activeFilter: boolean
  isOpen: boolean
  uniqueValues: string[]
  selected?: Set<string>
  onToggleOpen: (colKey: string | null) => void
  onToggleValue: (colKey: string, value: string) => void
  onClear: (colKey: string) => void
  onSelectAll?: (colKey: string, values: string[]) => void
  onSelectNone?: (colKey: string) => void
  maxOptions?: number
  titleClassName?: string
  variant?: 'indigo' | 'gray' | 'amber'
}) {
  const [search, setSearch] = useState('')

  const btnClass =
    variant === 'amber'
      ? activeFilter
        ? 'bg-amber-200 text-amber-900'
        : 'text-amber-500 hover:bg-amber-100'
      : variant === 'gray'
        ? activeFilter
          ? 'bg-gray-300 text-gray-900'
          : 'text-gray-400 hover:bg-gray-200'
        : activeFilter
          ? 'bg-indigo-200 text-indigo-900'
          : 'text-indigo-400 hover:bg-indigo-100'

  const filteredValues = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = uniqueValues.slice(0, maxOptions)
    if (!q) return list
    return list.filter((v) => v.toLowerCase().includes(q))
  }, [uniqueValues, search, maxOptions])

  const allChecked =
    filteredValues.length > 0 && filteredValues.every((v) => selected?.has(v))

  return (
    <div className="flex items-center gap-0.5 px-1 relative">
      <span className={titleClassName} title={title}>
        {title}
      </span>
      <button
        type="button"
        className={`p-0.5 rounded shrink-0 ${btnClass}`}
        title="Фильтр по столбцу (как в Excel)"
        onClick={(e) => {
          e.stopPropagation()
          if (!isOpen) setSearch('')
          onToggleOpen(isOpen ? null : colKey)
        }}
      >
        <Filter className="h-3 w-3" />
      </button>
      {isOpen && (
        <div
          className="absolute left-0 top-full mt-0.5 z-50 bg-white border border-gray-300 rounded shadow-lg p-2 min-w-[220px] max-h-64 overflow-hidden flex flex-col font-normal text-gray-800"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-1 shrink-0">
            <span className="text-[10px] text-gray-500 font-semibold">Фильтр</span>
            <button type="button" className="text-[10px] text-indigo-600 hover:underline" onClick={() => onClear(colKey)}>
              Сбросить
            </button>
          </div>
          <input
            type="text"
            placeholder="Поиск…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-7 px-2 mb-1 text-[10px] border border-gray-200 rounded shrink-0"
          />
          <div className="flex gap-2 mb-1 shrink-0 text-[10px]">
            <button
              type="button"
              className="text-indigo-600 hover:underline disabled:text-gray-300"
              disabled={!filteredValues.length}
              onClick={() => onSelectAll?.(colKey, filteredValues)}
            >
              Выбрать все
            </button>
            <button
              type="button"
              className="text-gray-600 hover:underline"
              onClick={() => {
                onSelectNone?.(colKey)
                setSearch('')
              }}
            >
              Снять все
            </button>
          </div>
          <label className="flex items-center gap-1.5 py-0.5 text-[10px] cursor-pointer border-b border-gray-100 mb-1 shrink-0 font-medium">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={() => {
                if (allChecked) onSelectNone?.(colKey)
                else onSelectAll?.(colKey, filteredValues)
              }}
            />
            <span>(Выбрать отображаемые)</span>
          </label>
          <div className="overflow-auto flex-1 min-h-0">
            {filteredValues.map((v) => (
              <label key={v} className="flex items-center gap-1.5 py-0.5 text-[10px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected?.has(v) ?? false}
                  onChange={() => onToggleValue(colKey, v)}
                />
                <span className="truncate" title={v}>
                  {v || '(пусто)'}
                </span>
              </label>
            ))}
            {!filteredValues.length && (
              <p className="text-[10px] text-gray-400 py-1">
                {search ? 'Нет совпадений' : 'Нет значений'}
              </p>
            )}
          </div>
          {uniqueValues.length > maxOptions && !search && (
            <p className="text-[9px] text-gray-400 mt-1 shrink-0">
              Показаны первые {maxOptions} из {uniqueValues.length}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
