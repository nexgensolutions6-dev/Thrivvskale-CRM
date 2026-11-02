/**
 * `getScoreboard`: the day's call numbers, the targets in force that day and the
 * streak, from the scoreboard_daily view (Kolkata days). Uses the user's client,
 * so RLS applies. The streak steps over rest days (workspace working days and
 * state holidays). `day` is a Kolkata date (YYYY-MM-DD). Called by the Today page,
 * the app layout (menu bar chip) and the DB tests.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import holidaysJson from '../../../supabase/seed/holidays.json'
import { isWorkingDay } from '@/lib/calendar/isWorkingDay'
import { addDays } from '@/lib/calendar/kolkataDate'
import { readWorkspaceCalendar } from '@/lib/calendar/readWorkspaceCalendar'
import type { Holiday } from '@/lib/calendar/types'
import type { Database } from '@/lib/db/types'
import { stepError } from '@/lib/step-error'
import { readTargetRows } from './readTargetRows'
import { countStreak, STREAK_LOOKBACK_DAYS } from './streak'
import { targetOn, type TargetRow } from './targetOn'
import type { Scoreboard } from './types'

const MODULE = 'getScoreboard'

const HOLIDAYS: Holiday[] = holidaysJson

type DayRow = Database['public']['Views']['scoreboard_daily']['Row']
type Db = SupabaseClient<Database>

async function readDays(db: Db, workspaceId: string, day: string): Promise<DayRow[]> {
  const result = await db.from('scoreboard_daily').select('day, dials, connects, conversations, meetings_booked')
    .eq('workspace_id', workspaceId).gte('day', addDays(day, -STREAK_LOOKBACK_DAYS)).lte('day', day)
  if (result.error) throw stepError(MODULE, `read scoreboard days up to ${day}`, result.error)
  return result.data as DayRow[]
}

function daysMeetingCallTarget(rows: DayRow[], targetRows: TargetRow[]): Set<string> {
  const met = new Set<string>()
  for (const row of rows) {
    if (row.day === null || row.dials === null) continue
    const goal = targetOn(targetRows, row.day).calls
    if (goal > 0 && row.dials >= goal) met.add(row.day)
  }
  return met
}

export async function getScoreboard(db: Db, workspaceId: string, day: string): Promise<Scoreboard> {
  const [rows, targetRows, calendar] = await Promise.all([
    readDays(db, workspaceId, day),
    readTargetRows(db, workspaceId),
    readWorkspaceCalendar(db, workspaceId),
  ])
  const isRestDay = (ymd: string) => !isWorkingDay(ymd, calendar.home_state ?? '', HOLIDAYS, calendar.working_days)
  const today = rows.find((row) => row.day === day)
  return {
    calls: today?.dials ?? 0,
    connects: today?.connects ?? 0,
    conversations: today?.conversations ?? 0,
    demos: today?.meetings_booked ?? 0,
    streakDays: countStreak(daysMeetingCallTarget(rows, targetRows), day, isRestDay),
    targets: targetOn(targetRows, day),
  }
}
