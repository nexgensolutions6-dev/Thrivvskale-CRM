/**
 * Best calling window per vertical group (Kolkata time), plus the helper that
 * maps a vertical name to its window key. The times are starting defaults,
 * to be tuned from connect data. Called by the callback-scheduling code.
 */
import type { TimeWindow } from './types'

export const BEST_WINDOWS: Record<string, TimeWindow> = {
  clinics: { start: '14:00', end: '16:00' },
  coaching: { start: '11:00', end: '15:00' },
  manufacturing: { start: '10:30', end: '12:30' },
  interiors: { start: '11:00', end: '13:00' },
  other: { start: '11:00', end: '13:00' },
}

// Same normalising as tierForVertical in src/lib/domain.ts.
const normalizeVertical = (v: string): string => v.trim().replace(/\s+/g, ' ').toLowerCase()

/** The BEST_WINDOWS key for a vertical name; anything unrecognised is "other". */
export function windowKeyForVertical(vertical: string): string {
  const name = normalizeVertical(vertical)
  if (name.includes('clinics')) return 'clinics'
  if (name.includes('coaching')) return 'coaching'
  if (name.includes('manufacturing')) return 'manufacturing'
  if (name.includes('interiors')) return 'interiors'
  return 'other'
}
