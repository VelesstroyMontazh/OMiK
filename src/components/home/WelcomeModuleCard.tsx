'use client'

import type { HomeModuleDef } from '@/lib/home-modules'
import { openHomeModule } from '@/lib/home-modules'

export default function WelcomeModuleCard({ mod }: { mod: HomeModuleDef }) {
  const Icon = mod.Icon
  return (
    <div
      className={`p-4 bg-gradient-to-r border-2 rounded-xl shadow-lg cursor-pointer hover:shadow-xl transition-all h-full ${mod.cardClass}`}
      onClick={() => openHomeModule(mod)}
    >
      <div className="flex items-start gap-3 h-full">
        <div
          className={`w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center shadow shrink-0 ${mod.iconBoxClass}`}
        >
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`text-[13px] font-bold leading-tight ${mod.titleClass}`}>{mod.title}</h3>
          <p className={`text-[10px] mt-0.5 line-clamp-2 ${mod.subtitleClass}`}>{mod.subtitle}</p>
          {mod.hint ? (
            <p className={`text-[9px] mt-0.5 line-clamp-1 ${mod.hintClass}`}>{mod.hint}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
