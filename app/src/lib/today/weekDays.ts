/**
 * The Monday to Saturday dates (Kolkata, YYYY-MM-DD) shown on the Today week
 * calendar: the week containing `today`, or the coming week when today is a
 * Sunday. Pure. Called by loadToday and the Today e2e test.
 */
import { addDays, isoWeekday } from '@/lib/calendar/kolkataDate'

const DAYS_SHOWN = 6

export function weekDays(today: string): string[] {
  const weekday = isoWeekday(today)
  const monday = weekday === 7 ? addDays(today, 1) : addDays(today, 1 - weekday)
  return Array.from({ length: DAYS_SHOWN }, (_, offset) => addDays(monday, offset))
}
