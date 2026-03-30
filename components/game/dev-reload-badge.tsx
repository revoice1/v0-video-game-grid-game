'use client'

import { useMemo } from 'react'

const DEV_BOOT_KEY = 'gamegrid_dev_boot_count'

function readBootCount() {
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'production') {
    return null
  }

  const current = Number.parseInt(window.sessionStorage.getItem(DEV_BOOT_KEY) ?? '0', 10)
  const next = Number.isFinite(current) ? current + 1 : 1
  window.sessionStorage.setItem(DEV_BOOT_KEY, String(next))
  return next
}

export function DevReloadBadge() {
  const bootCount = useMemo(() => readBootCount(), [])

  if (process.env.NODE_ENV === 'production' || bootCount === null) {
    return null
  }

  return (
    <div className="fixed bottom-3 right-3 z-[120] rounded-full border border-amber-400/35 bg-background/88 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200 shadow-lg backdrop-blur-sm">
      Dev Boot {bootCount}
    </div>
  )
}
