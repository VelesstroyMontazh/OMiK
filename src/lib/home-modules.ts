import { TICKET_COSTS_MODULE_SUBTITLE } from '@/components/excel/ticketCostsRegistries'
import { useExcelStore } from '@/store/excel-store'
import type { LucideIcon } from 'lucide-react'
import {
  Award,
  BookOpen,
  Briefcase,
  ClipboardList,
  FlaskConical,
  GitMerge,
  Plane,
  Route,
  Settings,
  Target,
  Ticket,
  UserMinus,
  Users,
  Wand2,
} from 'lucide-react'

export type ModulePanelKind =
  | 'main-db'
  | 'data-merge'
  | 'ticket-costs'
  | 'calendar'
  | 'gelendzhik'
  | 'vba-laboratory'
  | 'file-prepare'
  | 'daily-accounting'
  | 'placeholder'

export interface HomeModuleDef {
  id: string
  title: string
  subtitle: string
  hint?: string
  panel: ModulePanelKind
  cardClass: string
  iconBoxClass: string
  titleClass: string
  subtitleClass: string
  hintClass: string
  iconAccentClass: string
  headerBarClass: string
  Icon: LucideIcon
}

/** Карточки на главном экране (порядок отображения). */
export const WELCOME_MODULE_CARDS: HomeModuleDef[] = [
  {
    id: 'main-db',
    title: 'Основная База Данных',
    subtitle: 'БД сотрудников • 112 270 записей',
    hint: 'Загрузка и управление — Настройки → БАЗА',
    panel: 'main-db',
    cardClass: 'from-amber-50 to-orange-50 border-amber-300 shadow-amber-200/30 hover:border-amber-400',
    iconBoxClass: 'from-amber-500 to-orange-600',
    titleClass: 'text-amber-900',
    subtitleClass: 'text-amber-700',
    hintClass: 'text-amber-500',
    iconAccentClass: 'text-amber-600',
    headerBarClass: 'from-amber-600 to-orange-600',
    Icon: Users,
  },
  {
    id: 'module-tenure',
    title: 'Стаж',
    subtitle: 'Учёт стажа сотрудников ВСМ и СК',
    hint: 'Раздел в разработке',
    panel: 'placeholder',
    cardClass: 'from-lime-50 to-green-50 border-lime-300 shadow-lime-200/30 hover:border-lime-400',
    iconBoxClass: 'from-lime-500 to-green-600',
    titleClass: 'text-lime-900',
    subtitleClass: 'text-lime-800',
    hintClass: 'text-lime-600',
    iconAccentClass: 'text-lime-600',
    headerBarClass: 'from-lime-600 to-green-700',
    Icon: Award,
  },
  {
    id: 'module-daily-accounting',
    title: 'Ежедневный учет',
    subtitle: 'Оперативный учёт персонала по дням',
    hint: 'Загрузка листа ЕЖЕДНЕВНЫЙ УЧЕТ по площадкам',
    panel: 'daily-accounting',
    cardClass: 'from-yellow-50 to-amber-50 border-yellow-300 shadow-yellow-200/30 hover:border-yellow-400',
    iconBoxClass: 'from-yellow-500 to-amber-600',
    titleClass: 'text-yellow-900',
    subtitleClass: 'text-yellow-800',
    hintClass: 'text-yellow-600',
    iconAccentClass: 'text-yellow-600',
    headerBarClass: 'from-yellow-600 to-amber-700',
    Icon: ClipboardList,
  },
  {
    id: 'calendar-module',
    title: 'Календарь Прилет-Вылет',
    subtitle: 'Календарь прилёта и вылета • связь с Базой',
    panel: 'calendar',
    cardClass: 'from-sky-50 to-cyan-50 border-sky-300 shadow-sky-200/30 hover:border-sky-400',
    iconBoxClass: 'from-sky-500 to-cyan-600',
    titleClass: 'text-sky-900',
    subtitleClass: 'text-sky-700',
    hintClass: 'text-sky-500',
    iconAccentClass: 'text-sky-600',
    headerBarClass: 'from-sky-600 to-cyan-700',
    Icon: Plane,
  },
  {
    id: 'module-carnet',
    title: 'Карнет',
    subtitle: 'Учёт и отчётность по карнетам',
    hint: 'Раздел в разработке',
    panel: 'placeholder',
    cardClass: 'from-rose-50 to-pink-50 border-rose-300 shadow-rose-200/30 hover:border-rose-400',
    iconBoxClass: 'from-rose-500 to-pink-600',
    titleClass: 'text-rose-900',
    subtitleClass: 'text-rose-800',
    hintClass: 'text-rose-600',
    iconAccentClass: 'text-rose-600',
    headerBarClass: 'from-rose-600 to-pink-700',
    Icon: BookOpen,
  },
  {
    id: 'module-dismissed',
    title: 'Отчет по Уволенному персоналу',
    subtitle: 'Аналитика и выгрузки по уволенным',
    hint: 'Раздел в разработке',
    panel: 'placeholder',
    cardClass: 'from-slate-50 to-gray-100 border-slate-300 shadow-slate-200/30 hover:border-slate-400',
    iconBoxClass: 'from-slate-500 to-gray-600',
    titleClass: 'text-slate-900',
    subtitleClass: 'text-slate-700',
    hintClass: 'text-slate-500',
    iconAccentClass: 'text-slate-600',
    headerBarClass: 'from-slate-600 to-gray-700',
    Icon: UserMinus,
  },
  {
    id: 'module-hiring-costs',
    title: 'Отчет по затратам на Трудоустройство',
    subtitle: 'Затраты на приём и трудоустройство',
    hint: 'Раздел в разработке',
    panel: 'placeholder',
    cardClass: 'from-orange-50 to-red-50 border-orange-300 shadow-orange-200/30 hover:border-orange-400',
    iconBoxClass: 'from-orange-500 to-red-600',
    titleClass: 'text-orange-900',
    subtitleClass: 'text-orange-800',
    hintClass: 'text-orange-600',
    iconAccentClass: 'text-orange-600',
    headerBarClass: 'from-orange-600 to-red-700',
    Icon: Briefcase,
  },
  {
    id: 'module-mobilization-plan',
    title: 'Отчет/План Мобилизации ОП',
    subtitle: 'Планирование и отчётность мобилизации ОП',
    hint: 'Раздел в разработке',
    panel: 'placeholder',
    cardClass: 'from-emerald-50 to-teal-50 border-emerald-300 shadow-emerald-200/30 hover:border-emerald-400',
    iconBoxClass: 'from-emerald-500 to-teal-600',
    titleClass: 'text-emerald-900',
    subtitleClass: 'text-emerald-800',
    hintClass: 'text-emerald-600',
    iconAccentClass: 'text-emerald-600',
    headerBarClass: 'from-emerald-600 to-teal-700',
    Icon: Target,
  },
  {
    id: 'module-utilities',
    title: 'Utilites for all',
    subtitle: 'Служебные инструменты и утилиты',
    hint: 'Раздел в разработке',
    panel: 'placeholder',
    cardClass: 'from-zinc-50 to-stone-100 border-zinc-300 shadow-zinc-200/30 hover:border-zinc-400',
    iconBoxClass: 'from-zinc-500 to-stone-600',
    titleClass: 'text-zinc-900',
    subtitleClass: 'text-zinc-700',
    hintClass: 'text-zinc-500',
    iconAccentClass: 'text-zinc-600',
    headerBarClass: 'from-zinc-600 to-stone-700',
    Icon: Settings,
  },
  {
    id: 'data-merge',
    title: 'Объединение данных',
    subtitle: 'Файлы/папка • заголовки • один файл',
    hint: 'Равные заголовки, выбор колонок, сопоставление',
    panel: 'data-merge',
    cardClass: 'from-blue-50 to-indigo-50 border-blue-300 shadow-blue-200/30 hover:border-blue-400',
    iconBoxClass: 'from-blue-500 to-indigo-600',
    titleClass: 'text-blue-900',
    subtitleClass: 'text-blue-700',
    hintClass: 'text-blue-500',
    iconAccentClass: 'text-blue-600',
    headerBarClass: 'from-blue-700 to-indigo-700',
    Icon: GitMerge,
  },
  {
    id: 'ticket-costs',
    title: 'Затраты по билетам',
    subtitle: TICKET_COSTS_MODULE_SUBTITLE,
    hint: 'Массовая загрузка • дедупликация • База',
    panel: 'ticket-costs',
    cardClass: 'from-indigo-50 to-violet-50 border-indigo-300 shadow-indigo-200/30 hover:border-indigo-400',
    iconBoxClass: 'from-indigo-500 to-violet-600',
    titleClass: 'text-indigo-900',
    subtitleClass: 'text-indigo-700',
    hintClass: 'text-indigo-500',
    iconAccentClass: 'text-indigo-600',
    headerBarClass: 'from-indigo-600 to-violet-700',
    Icon: Ticket,
  },
  {
    id: 'gelendzhik-career',
    title: 'Путь сотрудника',
    subtitle: 'Полная история трудовой деятельности сотрудников ВСМ и СК',
    panel: 'gelendzhik',
    cardClass: 'from-teal-50 to-emerald-50 border-teal-300 shadow-teal-200/30 hover:border-teal-400',
    iconBoxClass: 'from-teal-500 to-emerald-600',
    titleClass: 'text-teal-900',
    subtitleClass: 'text-teal-700',
    hintClass: 'text-teal-500',
    iconAccentClass: 'text-teal-600',
    headerBarClass: 'from-teal-600 to-emerald-700',
    Icon: Route,
  },
  {
    id: 'vba-laboratory',
    title: 'Лаборатория VBA+PY',
    subtitle: 'Импорт макросов из Excel',
    hint: 'Редактирование • сохранение в программе',
    panel: 'vba-laboratory',
    cardClass: 'from-fuchsia-50 to-pink-50 border-fuchsia-300 shadow-fuchsia-200/30 hover:border-fuchsia-400',
    iconBoxClass: 'from-fuchsia-500 to-pink-600',
    titleClass: 'text-fuchsia-900',
    subtitleClass: 'text-fuchsia-700',
    hintClass: 'text-fuchsia-500',
    iconAccentClass: 'text-fuchsia-600',
    headerBarClass: 'from-fuchsia-600 to-pink-700',
    Icon: FlaskConical,
  },
  {
    id: 'file-prepare',
    title: 'Подготовка файла Excel',
    subtitle: 'Листы • столбцы • фильтры',
    hint: 'Формулы → значения',
    panel: 'file-prepare',
    cardClass: 'from-violet-50 to-purple-50 border-violet-300 shadow-violet-200/30 hover:border-violet-400',
    iconBoxClass: 'from-violet-500 to-purple-600',
    titleClass: 'text-violet-900',
    subtitleClass: 'text-violet-700',
    hintClass: 'text-violet-500',
    iconAccentClass: 'text-violet-600',
    headerBarClass: 'from-violet-600 to-purple-700',
    Icon: Wand2,
  },
]

/** Сериализуемая карточка (без React-компонентов). */
export type HomeModuleSerialized = {
  id: string
  title: string
  subtitle: string
  hint?: string
  panel: ModulePanelKind
  iconName: string
  cardClass: string
  iconBoxClass: string
  titleClass: string
  subtitleClass: string
  hintClass: string
  iconAccentClass: string
  headerBarClass: string
}

export const HOME_ICON_BY_NAME: Record<string, LucideIcon> = {
  Users,
  Award,
  ClipboardList,
  Plane,
  Briefcase,
  UserMinus,
  GitMerge,
  Target,
  BookOpen,
  Ticket,
  Route,
  FlaskConical,
  Wand2,
  Settings,
}

export function serializeWelcomeModule(mod: HomeModuleDef): HomeModuleSerialized {
  const iconName =
    Object.entries(HOME_ICON_BY_NAME).find(([, Icon]) => Icon === mod.Icon)?.[0] ?? 'Users'
  return {
    id: mod.id,
    title: mod.title,
    subtitle: mod.subtitle,
    hint: mod.hint,
    panel: mod.panel,
    iconName,
    cardClass: mod.cardClass,
    iconBoxClass: mod.iconBoxClass,
    titleClass: mod.titleClass,
    subtitleClass: mod.subtitleClass,
    hintClass: mod.hintClass,
    iconAccentClass: mod.iconAccentClass,
    headerBarClass: mod.headerBarClass,
  }
}

export function deserializeWelcomeModule(raw: HomeModuleSerialized): HomeModuleDef {
  const Icon = HOME_ICON_BY_NAME[raw.iconName] ?? Users
  return { ...raw, Icon }
}

export function deserializeWelcomeModules(list: HomeModuleSerialized[]): HomeModuleDef[] {
  return list.map(deserializeWelcomeModule)
}

export const DEFAULT_WELCOME_SERIALIZED: HomeModuleSerialized[] =
  WELCOME_MODULE_CARDS.map(serializeWelcomeModule)

const BY_ID = new Map(WELCOME_MODULE_CARDS.map((m) => [m.id, m]))

let _runtimeCards: HomeModuleDef[] | null = null
let _runtimeById: Map<string, HomeModuleDef> | null = null

export function setRuntimeWelcomeModules(mods: HomeModuleDef[]): void {
  _runtimeCards = mods
  _runtimeById = new Map(mods.map((m) => [m.id, m]))
}

export function getWelcomeModuleCards(): HomeModuleDef[] {
  return _runtimeCards ?? WELCOME_MODULE_CARDS
}

export function getHomeModule(id: string | undefined | null): HomeModuleDef | undefined {
  if (!id) return undefined
  if (_runtimeById) return _runtimeById.get(id)
  return BY_ID.get(id)
}

export function openHomeModule(mod: HomeModuleDef): void {
  const size = mod.id === 'main-db' ? 19539715 : 0
  useExcelStore.getState().navigateTo({
    id: mod.id,
    name: mod.title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    size,
  })
}
