'use client'

import React, { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  checkSettingsPassword,
  isSettingsAuthenticated,
  setSettingsAuthenticated,
} from '@/lib/settings-password'
import MainDbSettingsTab from '@/components/settings/MainDbSettingsTab'
import WelcomeConstructorTab from '@/components/settings/WelcomeConstructorTab'
import { Database, LayoutGrid, Lock } from 'lucide-react'

type SettingsTab = 'base' | 'welcome'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function SettingsDialog({ open, onOpenChange }: Props) {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [tab, setTab] = useState<SettingsTab>('base')

  useEffect(() => {
    if (open) {
      setAuthed(isSettingsAuthenticated())
      setPassword('')
      setError('')
      setTab('base')
    }
  }, [open])

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Настройки</DialogTitle>
        </DialogHeader>

        {!authed ? (
          <form onSubmit={handleLogin} className="py-4 space-y-4">
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
            <div className="flex gap-2 border-b border-gray-200 pb-2 shrink-0">
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
                  tab === 'welcome' ? 'bg-green-100 text-green-900' : 'text-gray-600 hover:bg-gray-100'
                }`}
                onClick={() => setTab('welcome')}
              >
                <LayoutGrid className="h-4 w-4" />
                Главный экран
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto py-2">
              {tab === 'base' ? <MainDbSettingsTab /> : <WelcomeConstructorTab />}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
