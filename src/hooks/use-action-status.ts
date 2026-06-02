'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ActionStatusState, ActionStep, StepState } from '@/lib/action-status-store'
import type { createActionStatusStore } from '@/lib/action-status-store'

export type { ActionStatusState, ActionStep, StepState }

type ActionStore = ReturnType<typeof createActionStatusStore>

function calcProgress(steps: ActionStep[]): number {
  if (!steps.length) return 0
  const done = steps.filter((s) => s.status === 'done').length
  const active = steps.some((s) => s.status === 'active')
  const base = (done / steps.length) * 100
  return active ? Math.min(99, base + 100 / steps.length / 2) : done === steps.length ? 100 : base
}

export function useActionStatus(
  store: ActionStore,
  options?: { persistent?: boolean },
) {
  const persistent = options?.persistent ?? false
  const [localStatus, setLocalStatus] = useState<ActionStatusState | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const externalStatus = useSyncExternalStore(store.subscribe, store.get, store.get)
  const status = persistent ? externalStatus : localStatus

  const setStatus = useCallback(
    (updater: ActionStatusState | null | ((prev: ActionStatusState | null) => ActionStatusState | null)) => {
      if (persistent) {
        const prev = store.get()
        const next = typeof updater === 'function' ? updater(prev) : updater
        store.set(next)
        return
      }
      setLocalStatus(updater)
    },
    [persistent, store],
  )

  const abortRef = useRef<AbortController | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => () => {
    clearTimer()
    abortRef.current?.abort()
  }, [clearTimer])

  const reset = useCallback(() => {
    clearTimer()
    setStatus(null)
  }, [clearTimer, setStatus])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    clearTimer()
    setStatus((prev) => {
      if (!prev) {
        return {
          active: false,
          title: 'Остановлено',
          steps: [{ id: 'stop', label: 'Остановлено пользователем', status: 'error' }],
          progress: 0,
          startedAt: Date.now(),
          error: 'Остановлено пользователем',
        }
      }
      const steps = prev.steps.map((s) =>
        s.status === 'active' ? { ...s, status: 'error' as StepState } : s,
      )
      return {
        ...prev,
        active: false,
        steps,
        error: 'Остановлено пользователем',
        detail: undefined,
      }
    })
  }, [clearTimer, setStatus])

  const start = useCallback(
    (title: string, stepLabels: string[]) => {
      clearTimer()
      abortRef.current?.abort()
      abortRef.current = new AbortController()
      const steps: ActionStep[] = stepLabels.map((label, i) => ({
        id: `step-${i}`,
        label,
        status: i === 0 ? 'active' : 'pending',
      }))
      setStatus({
        active: true,
        title,
        steps,
        progress: calcProgress(steps),
        startedAt: Date.now(),
        detail: stepLabels[0],
      })
      return steps.length
    },
    [clearTimer, setStatus],
  )

  const advance = useCallback(
    (detail?: string) => {
      setStatus((prev) => {
        if (!prev) return prev
        const steps = [...prev.steps]
        const activeIdx = steps.findIndex((s) => s.status === 'active')
        if (activeIdx >= 0) steps[activeIdx] = { ...steps[activeIdx], status: 'done' }
        const nextIdx = activeIdx + 1
        if (nextIdx < steps.length) {
          steps[nextIdx] = { ...steps[nextIdx], status: 'active' }
        }
        return {
          ...prev,
          steps,
          progress: calcProgress(steps),
          detail: detail ?? (nextIdx < steps.length ? steps[nextIdx].label : prev.detail),
        }
      })
    },
    [setStatus],
  )

  const setDetail = useCallback(
    (detail: string) => {
      setStatus((prev) => (prev ? { ...prev, detail } : prev))
    },
    [setStatus],
  )

  const startElapsedTimer = useCallback(
    (prefix: string) => {
      clearTimer()
      timerRef.current = setInterval(() => {
        setStatus((prev) => {
          if (!prev?.active) return prev
          const sec = Math.floor((Date.now() - prev.startedAt) / 1000)
          return { ...prev, detail: `${prefix} (${sec} с)` }
        })
      }, 1000)
    },
    [clearTimer, setStatus],
  )

  const complete = useCallback(
    (success?: string) => {
      clearTimer()
      setStatus((prev) => {
        if (!prev) return prev
        const steps = prev.steps.map((s) =>
          s.status === 'error' ? s : { ...s, status: 'done' as StepState },
        )
        return {
          ...prev,
          active: false,
          steps,
          progress: 100,
          success,
          detail: undefined,
        }
      })
    },
    [clearTimer, setStatus],
  )

  const fail = useCallback(
    (error: string) => {
      clearTimer()
      setStatus((prev) => {
        if (!prev) {
          return {
            active: false,
            title: 'Ошибка',
            steps: [],
            progress: 0,
            startedAt: Date.now(),
            error,
          }
        }
        const steps = prev.steps.map((s) =>
          s.status === 'active' ? { ...s, status: 'error' as StepState } : s,
        )
        return { ...prev, active: false, steps, error, detail: undefined }
      })
    },
    [clearTimer, setStatus],
  )

  const showResult = useCallback(
    (message: string, opts?: { title?: string; error?: boolean }) => {
      clearTimer()
      const title = opts?.title ?? (opts?.error ? 'Ошибка' : 'Готово')
      setStatus({
        active: false,
        title,
        steps: [{ id: 'result', label: message, status: opts?.error ? 'error' : 'done' }],
        progress: 100,
        startedAt: Date.now(),
        success: opts?.error ? undefined : message,
        error: opts?.error ? message : undefined,
      })
    },
    [clearTimer, setStatus],
  )

  const runAction = useCallback(
    async (
      title: string,
      stepLabels: string[],
      runner: (api: {
        advance: (detail?: string) => void
        setDetail: (detail: string) => void
        startElapsedTimer: (prefix: string) => void
        signal: AbortSignal
        checkAborted: () => void
      }) => Promise<string | void>,
    ): Promise<string | undefined> => {
      start(title, stepLabels)
      const signal = abortRef.current!.signal
      const checkAborted = () => {
        if (signal.aborted) {
          throw new DOMException('Остановлено пользователем', 'AbortError')
        }
      }
      try {
        const msg = await runner({ advance, setDetail, startElapsedTimer, signal, checkAborted })
        checkAborted()
        const success = typeof msg === 'string' ? msg : undefined
        complete(success)
        return success
      } catch (e) {
        if (signal.aborted || (e instanceof DOMException && e.name === 'AbortError')) {
          fail('Остановлено пользователем')
          return undefined
        }
        fail(e instanceof Error ? e.message : 'Неизвестная ошибка')
        throw e
      }
    },
    [advance, complete, fail, setDetail, start, startElapsedTimer],
  )

  return {
    status,
    reset,
    start,
    advance,
    setDetail,
    complete,
    fail,
    stop,
    showResult,
    runAction,
  }
}
