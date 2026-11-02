/**
 * Estimates call length from how long the user was away after tapping a tel:
 * link. Away under 5 seconds means the dialer was cancelled: the call was not
 * placed and must not be logged. Called by useCallReturn.
 */
const MIN_AWAY_MS = 5_000

/** Whole seconds away, or null when the call was not placed. Times are epoch milliseconds. */
export function estimateDurationSeconds(leftAt: number, returnedAt: number): number | null {
  const awayMs = returnedAt - leftAt
  if (!(awayMs >= MIN_AWAY_MS)) return null // the negated >= also catches NaN
  return Math.floor(awayMs / 1000)
}
