'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  HOME_ICON_BY_NAME,
  serializeWelcomeModule,
  type HomeModuleSerialized,
  type ModulePanelKind,
} from '@/lib/home-modules'
import { useWelcomeModules } from '@/hooks/use-welcome-modules'
import { ChevronDown, ChevronUp, Loader2, Save } from 'lucide-react'

const PANEL_OPTIONS: ModulePanelKind[] = [
  'main-db',
  'data-merge',
  'ticket-costs',
  'calendar',
  'gelendzhik',
  'vba-laboratory',
  'file-prepare',
  'placeholder',
]

export default function WelcomeConstructorTab() {
  const { modules, saveModules, loading } = useWelcomeModules()
  const [draft, setDraft] = useState<HomeModuleSerialized[]>([])
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && draft.length === 0) {
      setDraft(modules.map(serializeWelcomeModule))
    }
  }, [loading, modules, draft.length])

  const move = (index: number, dir: -1 | 1) => {
    const next = [...draft]
    const j = index + dir
    if (j < 0 || j >= next.length) return
    ;[next[index], next[j]] = [next[j], next[index]]
    setDraft(next)
  }

  const update = (id: string, patch: Partial<HomeModuleSerialized>) => {
    setDraft((list) => list.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveModules(draft)
      window.alert('Настройки главного экрана применены.')
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  if (loading && draft.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        Загрузка конструктора…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-600">
        Меняйте порядок, названия, подписи и классы Tailwind для карточек вкладок на главном экране.
      </p>
      <ul className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
        {draft.map((mod, index) => (
          <li key={mod.id} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50"
              onClick={() => setExpanded(expanded === mod.id ? null : mod.id)}
            >
              <span className="text-xs text-gray-400 w-5">{index + 1}</span>
              <span className="flex-1 text-sm font-medium truncate">{mod.title}</span>
              <div className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  disabled={index === draft.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
            </button>
            {expanded === mod.id && (
              <div className="px-3 pb-3 pt-1 border-t border-gray-100 grid gap-2 text-xs">
                <label className="block">
                  <span className="text-gray-500">Заголовок</span>
                  <input
                    className="mt-0.5 w-full border rounded px-2 py-1"
                    value={mod.title}
                    onChange={(e) => update(mod.id, { title: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-gray-500">Подзаголовок</span>
                  <input
                    className="mt-0.5 w-full border rounded px-2 py-1"
                    value={mod.subtitle}
                    onChange={(e) => update(mod.id, { subtitle: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-gray-500">Подсказка</span>
                  <input
                    className="mt-0.5 w-full border rounded px-2 py-1"
                    value={mod.hint || ''}
                    onChange={(e) => update(mod.id, { hint: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-gray-500">Панель</span>
                  <select
                    className="mt-0.5 w-full border rounded px-2 py-1"
                    value={mod.panel}
                    onChange={(e) => update(mod.id, { panel: e.target.value as ModulePanelKind })}
                  >
                    {PANEL_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-gray-500">Иконка</span>
                  <select
                    className="mt-0.5 w-full border rounded px-2 py-1"
                    value={mod.iconName}
                    onChange={(e) => update(mod.id, { iconName: e.target.value })}
                  >
                    {Object.keys(HOME_ICON_BY_NAME).map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-gray-500">Класс карточки (Tailwind)</span>
                  <input
                    className="mt-0.5 w-full border rounded px-2 py-1 font-mono text-[10px]"
                    value={mod.cardClass}
                    onChange={(e) => update(mod.id, { cardClass: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-gray-500">Класс иконки</span>
                  <input
                    className="mt-0.5 w-full border rounded px-2 py-1 font-mono text-[10px]"
                    value={mod.iconBoxClass}
                    onChange={(e) => update(mod.id, { iconBoxClass: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-gray-500">Заголовок (цвет)</span>
                  <input
                    className="mt-0.5 w-full border rounded px-2 py-1 font-mono text-[10px]"
                    value={mod.titleClass}
                    onChange={(e) => update(mod.id, { titleClass: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-gray-500">Полоса шапки модуля</span>
                  <input
                    className="mt-0.5 w-full border rounded px-2 py-1 font-mono text-[10px]"
                    value={mod.headerBarClass}
                    onChange={(e) => update(mod.id, { headerBarClass: e.target.value })}
                  />
                </label>
              </div>
            )}
          </li>
        ))}
      </ul>
      <Button
        className="w-full bg-green-700 hover:bg-green-800"
        disabled={saving}
        onClick={() => void handleSave()}
      >
        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
        Сохранить и Применить
      </Button>
    </div>
  )
}
