'use client'

import { dailyAccountingActionStore } from '@/lib/daily-accounting-action-store'
import { useActionStatus } from '@/hooks/use-action-status'

export function useDailyActionStatus() {
  return useActionStatus(dailyAccountingActionStore, { persistent: true })
}
