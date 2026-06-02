export type StepState = 'pending' | 'active' | 'done' | 'error'

export interface ActionStep {
  id: string
  label: string
  status: StepState
}

export interface ActionStatusState {
  active: boolean
  title: string
  steps: ActionStep[]
  detail?: string
  progress: number
  startedAt: number
  error?: string
  success?: string
}

type Listener = () => void

export function createActionStatusStore() {
  let status: ActionStatusState | null = null
  const listeners = new Set<Listener>()

  return {
    get(): ActionStatusState | null {
      return status
    },
    subscribe(listener: Listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    set(next: ActionStatusState | null) {
      status = next
      listeners.forEach((l) => l())
    },
    patch(patch: Partial<ActionStatusState>) {
      if (!status) return
      status = { ...status, ...patch }
      listeners.forEach((l) => l())
    },
  }
}
