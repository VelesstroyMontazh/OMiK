'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  DEFAULT_WELCOME_SERIALIZED,
  deserializeWelcomeModules,
  getWelcomeModuleCards,
  setRuntimeWelcomeModules,
  type HomeModuleDef,
  type HomeModuleSerialized,
  WELCOME_MODULE_CARDS,
} from '@/lib/home-modules'

export function useWelcomeModules() {
  const [modules, setModules] = useState<HomeModuleDef[]>(getWelcomeModuleCards())
  const [loading, setLoading] = useState(true)

  const applyModules = useCallback((list: HomeModuleDef[]) => {
    setRuntimeWelcomeModules(list)
    setModules([...list])
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/excel/settings/welcome-modules')
        const data = (await res.json()) as { modules?: HomeModuleSerialized[] | null }
        if (!cancelled && data.modules?.length) {
          applyModules(deserializeWelcomeModules(data.modules))
        }
      } catch {
        if (!cancelled) applyModules(WELCOME_MODULE_CARDS)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [applyModules])

  const saveModules = useCallback(async (serialized: HomeModuleSerialized[]) => {
    const res = await fetch('/api/excel/settings/welcome-modules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modules: serialized }),
    })
    if (!res.ok) throw new Error('Не удалось сохранить настройки главного экрана')
    applyModules(deserializeWelcomeModules(serialized))
  }, [applyModules])

  return {
    modules,
    loading,
    saveModules,
    defaultSerialized: DEFAULT_WELCOME_SERIALIZED,
  }
}
