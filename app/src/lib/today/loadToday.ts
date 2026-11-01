/**
 * `loadToday`: everything the Today list needs except the scoreboard: due
 * callbacks and tasks, "Next up" and the Mon-Sat week. Uses the user's client,
 * so RLS applies. Called by the Today page.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays, kolkataInstant, kolkataYmd } from '@/lib/calendar/kolkataDate'
import type { Database } from '@/lib/db/types'
import { groupByDay } from './groupByDay'
import { readNextUp } from './readNextUp'
import { readOpenTasks } from './readOpenTasks'
import { sortDue } from './sortDue'
import type { TodayData } from './types'
import { weekDays } from './weekDays'

export async function loadToday(db: SupabaseClient<Database>, workspaceId: string, now: Date): Promise<TodayData> {
  const today = kolkataYmd(now)
  const days = weekDays(today)
  // Open tasks up to the end of the shown week: overdue ones, due ones and the week's later ones.
  const weekEnd = kolkataInstant(addDays(days[days.length - 1], 1), '00:00')
  const [tasks, nextUp] = await Promise.all([readOpenTasks(db, workspaceId, weekEnd), readNextUp(db, workspaceId, now)])
  return { today, due: sortDue(tasks, now), nextUp, week: groupByDay(tasks, days) }
}
