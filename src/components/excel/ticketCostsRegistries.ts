export type RegistryId = 'vsm' | 'sk'

export const REGISTRY_LABELS: Record<RegistryId, string> = {
  vsm: 'ВелесстройМонтаж',
  sk: 'Стройконстракшен',
}

export const TICKET_COSTS_EMPTY_HINT =
  `Нет данных. Загрузите билеты в реестрах ${REGISTRY_LABELS.vsm} и ${REGISTRY_LABELS.sk}.`

export const TICKET_COSTS_MODULE_SUBTITLE =
  `Дашборд KPI • ${REGISTRY_LABELS.vsm} • ${REGISTRY_LABELS.sk}`
