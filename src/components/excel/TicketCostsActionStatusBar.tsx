'use client'

import React, { useEffect, useState } from 'react'
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import type { ActionStatusState, ActionStep } from '@/components/excel/useTicketCostsActionStatus'

function StepIcon({ status }: { status: ActionStep['status'] }) {
  if (status === 'done') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
  if (status === 'active') return <Loader2 className="h-3.5 w-3.5 text-indigo-600 animate-spin shrink-0" />
  if (status === 'error') return <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
  return <Circle className="h-3.5 w-3.5 text-gray-300 shrink-0" />
}

function formatElapsed(ms: number) {
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec} с`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m} мин ${s} с`
}

export default function TicketCostsActionStatusBar({
  status,
  onDismiss,
  onStop,
  compact = false,
}: {
  status: ActionStatusState | null
  onDismiss?: () => void
  onStop?: () => void
  compact?: boolean
}) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!status?.active) return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [status?.active])

  if (!status) return null

  const elapsed = status.startedAt ? formatElapsed(now - status.startedAt) : ''
  const doneCount = status.steps.filter((s) => s.status === 'done').length
  const totalSteps = status.steps.length

  if (compact && !status.active && !status.error && !status.success) return null

  return (
    <div
      className={`rounded-lg border overflow-hidden ${
        status.error
          ? 'border-red-200 bg-red-50'
          : status.success && !status.active
            ? 'border-emerald-200 bg-emerald-50'
            : 'border-indigo-200 bg-indigo-50/80'
      }`}
    >
      <div className="px-3 py-2 flex items-start gap-2">
        {status.active && <Loader2 className="h-4 w-4 text-indigo-600 animate-spin mt-0.5 shrink-0" />}
        {!status.active && status.success && <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />}
        {!status.active && status.error && <XCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-gray-800 truncate">{status.title}</span>
            <span className="text-[10px] text-gray-500 shrink-0 tabular-nums">
              {status.active ? `${Math.round(status.progress)}%` : '100%'}
              {elapsed ? ` • ${elapsed}` : ''}
            </span>
          </div>
          {status.detail && status.active && (
            <p className="text-[11px] text-indigo-800 mt-0.5 truncate">{status.detail}</p>
          )}
          {status.success && !status.active && (
            <p className="text-[11px] text-emerald-800 mt-0.5">{status.success}</p>
          )}
          {status.error && (
            <p className="text-[11px] text-red-700 mt-0.5">{status.error}</p>
          )}
          <div className="mt-2">
            <Progress
              value={status.progress}
              className={`h-2 ${status.error ? 'bg-red-100' : status.success && !status.active ? 'bg-emerald-100' : 'bg-indigo-100'}`}
            />
          </div>
          {!compact && status.steps.length > 0 && (
            <ul className="mt-2 space-y-1 max-h-32 overflow-y-auto">
              {status.steps.map((step, i) => (
                <li
                  key={step.id}
                  className={`flex items-center gap-2 text-[10px] ${
                    step.status === 'active'
                      ? 'text-indigo-800 font-medium'
                      : step.status === 'done'
                        ? 'text-gray-600'
                        : step.status === 'error'
                          ? 'text-red-700'
                          : 'text-gray-400'
                  }`}
                >
                  <StepIcon status={step.status} />
                  <span className="truncate">
                    {i + 1}. {step.label}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {!compact && totalSteps > 0 && (
            <p className="text-[10px] text-gray-500 mt-1">
              Шаг {Math.min(doneCount + (status.active ? 1 : 0), totalSteps)} из {totalSteps}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          {status.active && onStop && (
            <button
              type="button"
              className="text-[10px] font-medium text-red-700 hover:text-red-900 px-2 py-0.5 rounded border border-red-200 bg-white"
              onClick={onStop}
            >
              Стоп
            </button>
          )}
          {!status.active && onDismiss && (
            <button
              type="button"
              className="text-[10px] text-gray-500 hover:text-gray-700"
              onClick={onDismiss}
            >
              Закрыть
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
