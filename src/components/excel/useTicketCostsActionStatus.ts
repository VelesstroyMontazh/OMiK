'use client'

import { useActionStatus } from '@/hooks/use-action-status'
import { ticketCostsActionStore } from '@/components/excel/ticketCostsLoadActionStore'

export type { ActionStatusState, ActionStep, StepState } from '@/lib/action-status-store'

export function useTicketCostsActionStatus(options?: { persistent?: boolean }) {
  return useActionStatus(ticketCostsActionStore, options)
}
