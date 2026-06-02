'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppUser } from '@/hooks/use-app-user'
import type { AppUser } from '@/lib/app-auth'

export default function AppLoginBar({ align = 'center' }: { align?: 'left' | 'center' }) {
  const { user, ready, setUser } = useAppUser()
  const alignCls = align === 'left' ? 'justify-start text-left' : 'justify-center text-center'
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')

  if (!ready) {
    return (
      <div
        className={`flex flex-wrap items-center gap-2 text-xs min-h-7 ${alignCls}`}
        aria-hidden
      />
    )
  }

  if (user) {
    return (
      <p className={`text-xs text-gray-600 ${align === 'left' ? 'text-left' : 'text-center'}`}>
        Вход: <strong className="text-gray-800">{user.login}</strong>
        {user.role === 'admin' || user.role === 'cok'
          ? ' (полный доступ)'
          : ` — площадки: ${user.sites.join(', ') || '—'}`}
        <button
          type="button"
          className="ml-2 text-blue-600 hover:text-blue-800 underline"
          onClick={() => setUser(null)}
        >
          Выйти
        </button>
      </p>
    )
  }

  return (
    <form
      className={`flex flex-wrap items-center gap-2 text-xs ${alignCls} ${align === 'left' ? '' : 'max-w-lg mx-auto'}`}
      onSubmit={(e) => {
        e.preventDefault()
        setErr('')
        void (async () => {
          try {
            const res = await fetch('/api/excel/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ login, password }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
              setErr((data as { detail?: string }).detail || 'Ошибка входа')
              return
            }
            const u = (data as { user: AppUser }).user
            setUser(u)
          } catch {
            setErr('Сервер недоступен')
          }
        })()
      }}
    >
      <Input
        className="h-7 w-28 text-xs"
        placeholder="Логин"
        value={login}
        onChange={(e) => setLogin(e.target.value)}
      />
      <Input
        className="h-7 w-28 text-xs"
        type="password"
        placeholder="Пароль"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button type="submit" size="sm" className="h-7 text-xs">
        Войти
      </Button>
      {err && (
        <span className={`text-red-600 w-full ${align === 'left' ? 'text-left' : 'text-center'}`}>
          {err}
        </span>
      )}
    </form>
  )
}
