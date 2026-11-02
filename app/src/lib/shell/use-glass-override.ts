'use client'
/**
 * React hook for the "Lite glass" choice: returns the stored override and
 * re-renders when Settings changes it (this tab) or another tab does. Used by
 * GlassModeController (feeds GlassModeSync) and LiteGlassToggle (the switch).
 */
import { useSyncExternalStore } from 'react'
import { GLASS_OVERRIDE_EVENT, readGlassOverride, type GlassOverride } from './glass-override'

function subscribe(onChange: () => void): () => void {
  window.addEventListener(GLASS_OVERRIDE_EVENT, onChange)
  window.addEventListener('storage', onChange) // another tab changed localStorage
  return () => {
    window.removeEventListener(GLASS_OVERRIDE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

function serverSnapshot(): GlassOverride {
  return undefined // the server cannot see localStorage: "automatic" until the browser takes over
}

export function useGlassOverride(): GlassOverride {
  return useSyncExternalStore(subscribe, () => readGlassOverride(), serverSnapshot)
}
