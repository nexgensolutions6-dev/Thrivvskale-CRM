/**
 * Shapes of the Today screen data. Types only. Used by the loaders in this
 * folder and by the components in components/today.
 */

export type TodayTask = {
  id: string
  type: 'callback' | 'todo' | 'demo' | 'site_visit'
  title: string
  dueAt: Date
  companyId: string | null
  companyName: string | null
}

/** A due item: "overdue" if it was due on an earlier Kolkata day, else "due now". */
export type DueItem = TodayTask & { badge: 'overdue' | 'due now' }

export type NextUp = { companyId: string; name: string } | null

export type WeekDay = { day: string; tasks: TodayTask[] }

export type TodayData = {
  /** Kolkata date of "today". */
  today: string
  /** Due callbacks first, then other tasks; each oldest first. */
  due: DueItem[]
  nextUp: NextUp
  week: WeekDay[]
}
