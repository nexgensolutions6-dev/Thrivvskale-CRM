/**
 * The "Lite glass" choice from Settings, kept in localStorage. This is the
 * `userOverride` that chooseGlassMode (lib/glass/mode.ts) takes. Read by
 * useGlassOverride; written by the Settings toggle. Storage can be blocked
 * (private windows, site data off), so every access is wrapped and logged.
 */
import type { GlassEnv } from '@/lib/glass/mode'

const MODULE = 'shell/glass-override'

export const GLASS_OVERRIDE_KEY = 'thrivvskale.glassOverride'
/** Fired on `window` after a write in this tab (the browser's own `storage` event only reaches other tabs). */
export const GLASS_OVERRIDE_EVENT = 'thrivvskale:glass-override'

export type GlassOverride = GlassEnv['userOverride']

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** The latest choice made in this tab. Only used when storage is blocked, so the toggle still works for the visit. */
let visitChoice: GlassOverride
/** The page re-reads the choice often; say once that storage is blocked, not every time. */
let warnedAboutRead = false

/** Anything that is not a known choice means "automatic". */
export function parseGlassOverride(raw: string | null): GlassOverride {
  return raw === 'lite' || raw === 'full' ? raw : undefined
}

export function readGlassOverride(storage?: StorageLike): GlassOverride {
  try {
    return parseGlassOverride((storage ?? window.localStorage).getItem(GLASS_OVERRIDE_KEY))
  } catch (error) {
    if (!warnedAboutRead) console.warn(`[${MODULE}] read failed, keeping the choice for this visit only:`, error)
    warnedAboutRead = true
    return visitChoice
  }
}

/** `undefined` clears the choice (back to automatic). */
export function writeGlassOverride(value: GlassOverride, storage?: StorageLike): void {
  visitChoice = value
  try {
    const target = storage ?? window.localStorage
    if (value) target.setItem(GLASS_OVERRIDE_KEY, value)
    else target.removeItem(GLASS_OVERRIDE_KEY)
  } catch (error) {
    console.warn(`[${MODULE}] write failed, the choice will not survive a reload:`, error)
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(GLASS_OVERRIDE_EVENT))
}

/** Unit tests only: forget the visit's choice and the "already warned" flag. */
export function resetGlassOverrideForTests(): void {
  visitChoice = undefined
  warnedAboutRead = false
}
