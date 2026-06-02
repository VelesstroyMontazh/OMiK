'use client'

import React, { useCallback } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const COLORS = [
  // Standard row
  '#000000', '#434343', '#666666', '#999999', '#B7B7B7', '#CCCCCC', '#D9D9D9', '#EFEFEF', '#F3F3F3', '#FFFFFF',
  // Row 1
  '#980000', '#FF0000', '#FF9900', '#FFFF00', '#00FF00', '#00FFFF', '#4A86E8', '#0000FF', '#9900FF', '#FF00FF',
  // Row 2
  '#E6B8AF', '#F4CCCC', '#FCE5CD', '#FFF2CC', '#D9EAD3', '#D0E0E3', '#C9DAF8', '#CFE2F3', '#D9D2E9', '#EAD1DC',
  // Row 3
  '#DD7E6B', '#EA9999', '#F9CB9C', '#FFE599', '#B6D7A8', '#A2C4C9', '#A4C2F4', '#9FC5E8', '#B4A7D6', '#D5A6BD',
  // Row 4
  '#CC4125', '#E06666', '#F6B26B', '#FFD966', '#93C47D', '#76A5AF', '#6D9EEB', '#6FA8DC', '#8E7CC3', '#C27BA0',
  // Row 5
  '#A61C00', '#CC0000', '#E69138', '#F1C232', '#6AA84F', '#45818E', '#3C78D8', '#3D85C6', '#674EA7', '#A64D79',
  // Row 6
  '#85200C', '#990000', '#B45F06', '#BF9000', '#38761D', '#134F5C', '#1155CC', '#0B5394', '#351C75', '#741B47',
]

interface ColorPickerProps {
  color?: string
  onChange: (color: string) => void
  icon: React.ReactNode
  label: string
}

export default function ColorPicker({ color, onChange, icon, label }: ColorPickerProps) {
  const handleColorClick = useCallback(
    (c: string) => {
      onChange(c)
    },
    [onChange]
  )

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative h-7 w-7 flex flex-col items-center justify-center rounded hover:bg-gray-200"
          title={label}
        >
          {icon}
          <div
            className="absolute bottom-0.5 left-1 right-1 h-1 rounded-sm"
            style={{ backgroundColor: color || '#000000' }}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" side="bottom" align="start">
        <div className="grid grid-cols-10 gap-0.5">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`w-5 h-5 rounded-sm border cursor-pointer transition-transform hover:scale-125 ${
                color === c ? 'border-gray-800 ring-1 ring-gray-400' : 'border-gray-300'
              }`}
              style={{ backgroundColor: c }}
              onClick={() => handleColorClick(c)}
              title={c}
            />
          ))}
        </div>
        <div className="mt-2 pt-2 border-t border-gray-200 flex items-center gap-2">
          <input
            type="color"
            value={color || '#000000'}
            onChange={(e) => onChange(e.target.value)}
            className="w-6 h-6 cursor-pointer border-0 p-0"
            title="Пользовательский цвет"
          />
          <span className="text-xs text-gray-500">Пользовательский</span>
        </div>
      </PopoverContent>
    </Popover>
  )
}