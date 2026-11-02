/**
 * Picks the tasks that are due (due time reached) and orders them: callbacks
 * first, then other tasks, each oldest first. Marks each "overdue" (due on an
 * earlier Kolkata day) or "due now". Pure. Called by loadToday.
 */
import { kolkataYmd } from '@/lib/calendar/kolkataDate'
import type { DueItem, TodayTask } from './types'

const byDueAt = (a: TodayTask, b: TodayTask): number => a.dueAt.getTime() - b.dueAt.getTime()

export function sortDue(tasks: readonly TodayTask[], now: Date): DueItem[] {
  const today = kolkataYmd(now)
  const due = tasks
    .filter((task) => task.dueAt.getTime() <= now.getTime())
    .map((task): DueItem => ({ ...task, badge: kolkataYmd(task.dueAt) < today ? 'overdue' : 'due now' }))
  const callbacks = due.filter((task) => task.type === 'callback').sort(byDueAt)
  const others = due.filter((task) => task.type !== 'callback').sort(byDueAt)
  return [...callbacks, ...others]
}
