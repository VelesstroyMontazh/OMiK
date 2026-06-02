import { createActionStatusStore } from '@/lib/action-status-store'

/** Статус операций «Ежедневный учёт» — сохраняется при смене подвкладок. */
export const dailyAccountingActionStore = createActionStatusStore()
