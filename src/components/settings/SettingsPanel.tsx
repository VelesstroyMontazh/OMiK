'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  checkSettingsPassword,
  isSettingsAuthenticated,
  setSettingsAuthenticated,
} from '@/lib/settings-password'
import MainDbSettingsTab from '@/components/settings/MainDbSettingsTab'
import WelcomeConstructorTab from '@/components/settings/WelcomeConstructorTab'
import ReferencesSettingsTab from '@/components/settings/ReferencesSettingsTab'
import DailyTemplateSettingsTab from '@/components/settings/DailyTemplateSettingsTab'
import { BookOpen, ClipboardList, Database, LayoutGrid, Lock } from 'lucide-react'

type SettingsTab = 'base' | 'references' | 'daily' | 'welcome'

export default function SettingsPanel() {
  const [authed, setAuthed] = useState(isSettingsAuthenticated())
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [tab, setTab] = useState<SettingsTab>('base')

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (checkSettingsPassword(password)) {
      setSettingsAuthenticated()
      setAuthed(true)
      setError('')
    } else {
      setError('Неверный пароль')
    }
  }

  return (
    <div className="flex-1 min-h-0 bg-gray-50 p-4 sm:p-6 overflow-y-auto">
      <div className="mx-auto max-w-5xl rounded-xl border border-gray-200 bg-white shadow-sm p-4 sm:p-5">
        {!authed ? (
          <form onSubmit={handleLogin} className="py-4 space-y-4 max-w-md">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Lock className="h-4 w-4" />
              Введите пароль для доступа к настройкам
            </div>
            <Input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full">
              Войти
            </Button>
          </form>
        ) : (
          <>
            <div className="flex gap-2 border-b border-gray-200 pb-2 shrink-0 mb-4">
              <button
                type="button"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${
                  tab === 'base' ? 'bg-amber-100 text-amber-900' : 'text-gray-600 hover:bg-gray-100'
                }`}
                onClick={() => setTab('base')}
              >
                <Database className="h-4 w-4" />
                БАЗА
              </button>
              <button
                type="button"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${
                  tab === 'references' ? 'bg-blue-100 text-blue-900' : 'text-gray-600 hover:bg-gray-100'
                }`}
                onClick={() => setTab('references')}
              >
                <BookOpen className="h-4 w-4" />
                Справочники
              </button>
              <button
                type="button"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${
                  tab === 'daily' ? 'bg-yellow-100 text-yellow-900' : 'text-gray-600 hover:bg-gray-100'
                }`}
                onClick={() => setTab('daily')}
              >
                <ClipboardList className="h-4 w-4" />
                Ежедневный учёт
              </button>
              <button
                type="button"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${
                  tab === 'welcome' ? 'bg-green-100 text-green-900' : 'text-gray-600 hover:bg-gray-100'
                }`}
                onClick={() => setTab('welcome')}
              >
                <LayoutGrid className="h-4 w-4" />
                Главный экран
              </button>
            </div>
            {tab === 'base' && <MainDbSettingsTab />}
            {tab === 'references' && <ReferencesSettingsTab />}
            {tab === 'daily' && <DailyTemplateSettingsTab />}
            {tab === 'welcome' && <WelcomeConstructorTab />}
          </>
        )}
      </div>
    </div>
  )
}