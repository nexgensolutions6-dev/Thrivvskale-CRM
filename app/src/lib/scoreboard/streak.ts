/**
 * Counts a streak: consecutive Kolkata days that met the call target. Today not
 * being met yet does not break it; counting then starts from yesterday. Every
 * calendar day counts, so a missed Sunday or holiday ends the streak. Pure.
 * Called by getScoreboard.
 */
import { addDays } from '@/lib/calendar/kolkataDate'

export function countStreak(metDays: ReadonlySet<string>, today: string): number {
  let day = metDays.has(today) ? today : addDays(today, -1)
  let streak = 0
  while (metDays.has(day)) {
    streak += 1
    day = addDays(day, -1)
  }
  return streak
}
