'use client'
import { useEffect, useMemo, useState } from 'react'

const WEEKDAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const
const MONTH_NAMES = [
  'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
  'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек',
] as const

function formatDateCompact(d: Date): string {
  const s = d.toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function buildMonthCells(view: Date, today: Date) {
  const year = view.getFullYear()
  const month = view.getMonth()
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<{ day: number; isToday: boolean } | null> = []
  
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) {
    const isToday =
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === day
    cells.push({ day, isToday })
  }
  return cells
}

export default function WelcomeDateTimePanel({ className = '' }: { className?: string }) {
  // 1. Сначала объявляем все состояния
  const [now, setNow] = useState<Date>(new Date())
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  // 3. Затем useMemo и другие вычисления (они должны быть всегда!)
  const safeNow = now
  
  const monthCells = useMemo(() => buildMonthCells(safeNow, safeNow), [safeNow])
  const monthTitle = `${MONTH_NAMES[safeNow.getMonth()]} ${safeNow.getFullYear()}`
  const dateStr = formatDateCompact(safeNow)
  const timeStr = formatTime(safeNow)

  // 4. Только теперь возвращаем JSX
  // Если компонент еще не смонтирован, показываем статичную заглушку
  if (!isMounted) {
    return (
      <div className={`flex items-stretch gap-2 bg-white border border-gray-200 rounded-lg shadow-sm p-1.5 shrink-0 ${className}`}>
        <div className="flex flex-col justify-center min-w-[108px] max-w-[130px] pl-1 pr-2 border-r border-gray-100">
          <p className="text-[10px] text-gray-600 leading-tight">Загрузка...</p>
          <p className="text-lg font-semibold tabular-nums text-gray-900 leading-none mt-1">--:--:--</p>
        </div>
        <div className="w-[148px] shrink-0" />
      </div>
    )
  }

  return (
    <div className={`flex items-stretch gap-2 bg-white border border-gray-200 rounded-lg shadow-sm p-1.5 shrink-0 ${className}`}>
      {/* Дата и время — слева от календаря */}
      <div className="flex flex-col justify-center min-w-[108px] max-w-[130px] pl-1 pr-2 border-r border-gray-100">
        <p className="text-[10px] text-gray-600 leading-tight">{dateStr}</p>
        <p className="text-lg font-semibold tabular-nums text-gray-900 leading-none mt-1">
          {timeStr}
        </p>
      </div>
      
      {/* Мини-календарь */}
      <div className="w-[148px] shrink-0">
        <p className="text-[9px] font-semibold text-gray-700 text-center mb-0.5">{monthTitle}</p>
        <div className="grid grid-cols-7 gap-px text-center">
          {WEEKDAY_SHORT.map((wd) => (
            <span key={wd} className="text-[8px] font-medium text-gray-400">
              {wd}
            </span>
          ))}
          {monthCells.map((cell, idx) =>
            cell ? (
              <span
                key={idx}
                className={`text-[9px] py-0.5 rounded-sm leading-none ${
                  cell.isToday
                    ? 'bg-green-600 text-white font-bold'
                    : 'text-gray-700'
                }`}
              >
                {cell.day}
              </span>
            ) : (
              <span key={idx} className="py-0.5" aria-hidden />
            ),
          )}
        </div>
      </div>
    </div>
  )
}