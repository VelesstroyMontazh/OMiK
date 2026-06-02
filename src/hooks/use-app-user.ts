'use client'

import { useEffect, useState } from 'react'
import { getAppUser, setAppUser, type AppUser } from '@/lib/app-auth'

/** Пользователь из sessionStorage — только после монтирования (без hydration mismatch). */
export function useAppUser() {
  const [user, setUserState] = useState<AppUser | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setUserState(getAppUser())
    setReady(true)
  }, [])

  const setUser = (next: AppUser | null) => {
    setAppUser(next)
    setUserState(next)
  }

  return { user, ready, setUser }
}
