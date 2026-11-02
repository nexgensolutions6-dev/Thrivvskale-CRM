/**
 * Tunable numbers behind the dynamic queue score. Read only by
 * dynamicScore.ts; change a value here to re-balance the queue, nothing else.
 * Bonuses add to the score, penalties are subtracted (stored as positive numbers).
 */

/** Added once when the company shows buying intent (a score input, not a sort key). */
export const INTENT_BONUS = 10

/** Added once if any call ended `interested`. */
export const INTERESTED_BONUS = 15

/** Added once if any call ended `meeting_booked`. */
export const MEETING_BOOKED_BONUS = 20

/** Subtracted for each `gatekeeper` outcome, up to GATEKEEPER_PENALTY_CAP in total. */
export const GATEKEEPER_PENALTY_EACH = 5
export const GATEKEEPER_PENALTY_CAP = 15

/** Subtracted for each `no_answer` outcome, up to NO_ANSWER_PENALTY_CAP in total. */
export const NO_ANSWER_PENALTY_EACH = 2
export const NO_ANSWER_PENALTY_CAP = 10
