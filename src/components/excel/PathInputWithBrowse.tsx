'use client'

import React, { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { FolderOpen, Loader2 } from 'lucide-react'

type BrowseMode = 'file' | 'folder'

interface PathInputWithBrowseProps {
  value: string
  onChange: (path: string) => void
  mode?: BrowseMode
  placeholder?: string
  className?: string
  inputClassName?: string
  disabled?: boolean
}

export default function PathInputWithBrowse({
  value,
  onChange,
  mode = 'file',
  placeholder,
  className = 'flex flex-wrap items-center gap-2',
  inputClassName = 'h-8 flex-1 min-w-[240px] rounded border border-gray-300 px-2 text-xs bg-white',
  disabled = false,
}: PathInputWithBrowseProps) {
  const [browsing, setBrowsing] = useState(false)
  const [browseError, setBrowseError] = useState<string | null>(null)

  const handleBrowse = useCallback(async () => {
    setBrowseError(null)
    setBrowsing(true)
    try {
      const params = new URLSearchParams({ mode })
      const trimmed = value.trim()
      if (trimmed) {
        const dir =
          mode === 'folder'
            ? trimmed
            : trimmed.replace(/[/\\][^/\\]+$/, '')
        if (dir) params.set('initial_dir', dir)
      }
      const res = await fetch(`/api/excel/browse?${params.toString()}`)
      const data = (await res.json()) as { path?: string | null; cancelled?: boolean; detail?: string }
      if (!res.ok) {
        throw new Error(data.detail || 'Ошибка выбора пути')
      }
      if (data.path) {
        onChange(data.path)
      }
    } catch (e) {
      setBrowseError(e instanceof Error ? e.message : 'Ошибка обзора')
    } finally {
      setBrowsing(false)
    }
  }, [mode, onChange, value])

  return (
    <div className={className}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClassName}
        placeholder={placeholder}
        disabled={disabled || browsing}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 text-xs"
        disabled={disabled || browsing}
        onClick={() => void handleBrowse()}
        title={mode === 'folder' ? 'Выбрать папку' : 'Выбрать файл'}
      >
        {browsing ? (
          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
        ) : (
          <FolderOpen className="h-3.5 w-3.5 mr-1" />
        )}
        Обзор
      </Button>
      {browseError && (
        <span className="text-[10px] text-red-600 w-full">{browseError}</span>
      )}
    </div>
  )
}
