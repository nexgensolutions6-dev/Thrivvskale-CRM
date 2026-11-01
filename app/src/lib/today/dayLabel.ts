/**
 * Short label for a Kolkata date, like "Mon 3 Nov". Pure; no time zone is read.
 * Called by WeekCalendar.
 */
import { isoWeekday } from '@/lib/calendar/kolkataDate'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function dayLabel(ymd: string): string {
  const weekday = WEEKDAYS[isoWeekday(ymd) - 1]
  const month = MONTHS[Number(ymd.slice(5, 7)) - 1]
  return `${weekday} ${Number(ymd.slice(8, 10))} ${month}`
}
