/**
 * Picks the daily targets in force on a day: the row with the latest
 * `effective_from` that is on or before it, else all zeros. Pure. Called by
 * getScoreboard (for the day and for each streak day) and the Targets page.
 */
import type { TargetValues } from './types'

export type TargetRow = {
  effective_from: string
  dials: number
  conversations: number
  meetings_booked: number
}

const NO_TARGETS: TargetValues = { calls: 0, conversations: 0, demos: 0 }

export function targetOn(rows: readonly TargetRow[], day: string): TargetValues {
  let best: TargetRow | null = null
  for (const row of rows) {
    if (row.effective_from > day) continue
    if (best === null || row.effective_from > best.effective_from) best = row
  }
  if (best === null) return { ...NO_TARGETS }
  return { calls: best.dials, conversations: best.conversations, demos: best.meetings_booked }
}
