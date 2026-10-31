/**
 * Decides whether a Kolkata date is a working day: its weekday must be in the
 * configured working days and it must not be a holiday in the lead's state.
 * Called by schedule.ts.
 */
import { isStateHoliday } from './holidayLookup'
import { isoWeekday } from './kolkataDate'
import type { Holiday } from './types'

export function isWorkingDay(
  ymd: string,
  state: string,
  holidays: Holiday[],
  workingDays: number[],
): boolean {
  if (!workingDays.includes(isoWeekday(ymd))) return false
  return !isStateHoliday(holidays, state, ymd)
}
