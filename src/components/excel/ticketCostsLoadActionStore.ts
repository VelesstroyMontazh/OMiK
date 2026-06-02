'use client'

import { createActionStatusStore } from '@/lib/action-status-store'

export type {
  ActionStatusState,
  ActionStep,
  StepState,
} from '@/lib/action-status-store'

const store = createActionStatusStore()

/** @deprecated импортируйте типы из `@/lib/action-status-store` */
export const ticketCostsActionStore = store

export function getLoadActionStatus() {
  return store.get()
}

export function subscribeLoadActionStatus(listener: () => void) {
  return store.subscribe(listener)
}

export function setLoadActionStatus(next: import('@/lib/action-status-store').ActionStatusState | null) {
  store.set(next)
}

export function patchLoadActionStatus(patch: Partial<import('@/lib/action-status-store').ActionStatusState>) {
  store.patch(patch)
}
