'use client'
/**
 * Renders nothing. Asks the browser what it can afford (memory, accessibility
 * preferences, measured frame rate), picks 'full' | 'lite' | 'solid' with
 * chooseGlassMode, and sets <html data-glass="...">, which glass.css reads.
 * Mounted once in the app shell (Task 13) with the Settings override, if any.
 */
import { useEffect } from 'react'
import { chooseGlassMode, type GlassEnv } from '@/lib/glass/mode'
import { measureFps } from '@/lib/glass/measure-fps'

/** Wait for the first render burst to settle, then watch frames for a second. */
const MEASURE_DELAY_MS = 1500
const MEASURE_WINDOW_MS = 1000

type UserOverride = GlassEnv['userOverride']

function readEnv(userOverride: UserOverride): GlassEnv {
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  return {
    deviceMemoryGb: deviceMemory,
    prefersReducedTransparency: matchMedia('(prefers-reduced-transparency: reduce)').matches,
    // High contrast is treated like forced colors: both want plain, opaque surfaces.
    forcedColors: matchMedia('(forced-colors: active)').matches || matchMedia('(prefers-contrast: more)').matches,
    userOverride,
  }
}

function applyMode(env: GlassEnv): void {
  document.documentElement.dataset.glass = chooseGlassMode(env)
}

export function GlassModeSync({ userOverride }: { userOverride?: UserOverride }) {
  useEffect(() => {
    applyMode(readEnv(userOverride))
    if (userOverride) return // the user has chosen; nothing to measure

    let stopped = false
    const timer = window.setTimeout(() => {
      measureFps(MEASURE_WINDOW_MS)
        .then((fps) => {
          if (!stopped && fps !== undefined) applyMode({ ...readEnv(undefined), measuredFps: fps })
        })
        .catch((error: unknown) => console.warn('[GlassModeSync] frame-rate measurement failed:', error))
    }, MEASURE_DELAY_MS)

    return () => {
      stopped = true
      window.clearTimeout(timer)
    }
  }, [userOverride])

  return null
}
