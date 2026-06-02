'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Вертикальная прокрутка в области таблицы; горизонтальная — отдельная полоса
 * внизу блока (всегда на экране, не в конце тысяч строк).
 */
export default function DailyTableScrollBox({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  const vRef = useRef<HTMLDivElement>(null)
  const hBarRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [trackW, setTrackW] = useState(1200)
  const lock = useRef(false)

  const measure = useCallback(() => {
    const inner = innerRef.current
    const v = vRef.current
    if (!inner || !v) return
    const w = Math.max(inner.scrollWidth, inner.offsetWidth, v.clientWidth + 1)
    setTrackW(w)
  }, [])

  useEffect(() => {
    measure()
    const inner = innerRef.current
    if (!inner) return
    const ro = new ResizeObserver(() => measure())
    ro.observe(inner)
    const mo = new MutationObserver(() => measure())
    mo.observe(inner, { childList: true, subtree: true, attributes: true })
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      mo.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [measure, children])

  const syncH = (from: 'body' | 'bar') => {
    if (lock.current) return
    lock.current = true
    const v = vRef.current
    const bar = hBarRef.current
    if (v && bar) {
      if (from === 'body') bar.scrollLeft = v.scrollLeft
      else v.scrollLeft = bar.scrollLeft
    }
    lock.current = false
  }

  return (
    <div className={`flex flex-col flex-1 min-h-0 min-w-0 w-full h-full ${className}`}>
      <div
        ref={vRef}
        className="daily-scroll-v flex-1 min-h-0 min-w-0 w-full"
        onScroll={() => syncH('body')}
      >
        <div ref={innerRef} className="daily-scroll-inner">
          {children}
        </div>
      </div>
      <div
        ref={hBarRef}
        className="daily-scroll-h-bar shrink-0 w-full"
        onScroll={() => syncH('bar')}
        title="Прокрутка влево — вправо"
        aria-label="Горизонтальная прокрутка таблицы"
      >
        <div style={{ width: trackW, height: 1 }} aria-hidden />
      </div>
    </div>
  )
}
