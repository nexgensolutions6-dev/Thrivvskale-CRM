/**
 * Puts tasks under the Kolkata day they are due, for the given days only, in
 * time order. Pure. Called by loadToday.
 */
import { kolkataYmd } from '@/lib/calendar/kolkataDate'
import type { TodayTask, WeekDay } from './types'

export function groupByDay(tasks: readonly TodayTask[], days: readonly string[]): WeekDay[] {
  const ordered = [...tasks].sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
  return days.map((day) => ({ day, tasks: ordered.filter((task) => kolkataYmd(task.dueAt) === day) }))
}
