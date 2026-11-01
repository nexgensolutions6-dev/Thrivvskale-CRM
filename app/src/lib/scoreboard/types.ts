/**
 * Shapes of the scoreboard. Types only. Used by getScoreboard, saveTargets,
 * targetOn and the Today and Targets screens.
 */

/** Daily goals. `calls` is the `dials` column, `demos` is `meetings_booked`. */
export type TargetValues = { calls: number; conversations: number; demos: number }

export type Scoreboard = {
  calls: number
  connects: number
  conversations: number
  demos: number
  /** Consecutive days that met the call target, counted back from `day` (or yesterday). */
  streakDays: number
  targets: TargetValues
}
