/**
 * Answers "is this Kolkata date a holiday in this state?". The state name is
 * compared ignoring case and extra spaces. Called by isWorkingDay.ts.
 */
import type { Holiday } from './types'

const normalizeRegion = (region: string): string => region.trim().replace(/\s+/g, ' ').toLowerCase()

export function isStateHoliday(holidays: Holiday[], state: string, ymd: string): boolean {
  const wanted = normalizeRegion(state)
  return holidays.some((h) => h.date === ymd && normalizeRegion(h.region) === wanted)
}
