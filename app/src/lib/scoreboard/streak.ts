/**
 * Counts a streak: consecutive working Kolkata days that met the call target.
 * Today not being met yet does not break it. A rest day (Sunday, holiday) that
 * was not met is stepped over without counting; an unmet working day ends the
 * streak. Looks back at most 365 days. Pure. Called by getScoreboard.
 */
import { addDays } from '@/lib/calendar/kolkataDate'

/** How far back a streak is counted; a longer streak shows as this many days. */
export const STREAK_LOOKBACK_DAYS = 365

export function countStreak(
  metDays: ReadonlySet<string>,
  today: string,
  isRestDay: (ymd: string) => boolean,
): number {
  let streak = 0
  for (let back = 0; back <= STREAK_LOOKBACK_DAYS; back++) {
    const day = addDays(today, -back)
    if (metDays.has(day)) streak += 1
    else if (back > 0 && !isRestDay(day)) break
  }
  return streak
}
