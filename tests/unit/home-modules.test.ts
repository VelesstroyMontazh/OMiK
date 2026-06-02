import { describe, expect, it } from 'vitest'
import { getHomeModule, WELCOME_MODULE_CARDS } from '@/lib/home-modules'

describe('home-modules', () => {
  it('lists all welcome tabs without legacy Отчетность title', () => {
    const titles = WELCOME_MODULE_CARDS.map((m) => m.title)
    expect(titles).not.toContain('Отчетность')
    expect(titles).toContain('Календарь Прилет-Вылет')
    expect(titles).toContain('Стаж')
    expect(titles).toContain('Utilites for all')
    expect(WELCOME_MODULE_CARDS.length).toBeGreaterThanOrEqual(14)
  })

  it('maps calendar module to calendar panel', () => {
    const cal = getHomeModule('calendar-module')
    expect(cal?.title).toBe('Календарь Прилет-Вылет')
    expect(cal?.panel).toBe('calendar')
  })

  it('maps new modules to placeholder panel', () => {
    expect(getHomeModule('module-tenure')?.panel).toBe('placeholder')
    expect(getHomeModule('module-mobilization-plan')?.panel).toBe('placeholder')
  })
})
