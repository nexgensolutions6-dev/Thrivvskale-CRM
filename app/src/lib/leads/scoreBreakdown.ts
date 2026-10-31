/**
 * Explains a lead's queue score as lines ("Base score 65", "Buying intent +10",
 * "No answer x2 -4") for the Why call panel. Uses the same weights as
 * dynamicScore, so `total` always equals dynamicScore(base, signals). Pure.
 * Called by the WhyCall component.
 */
import type { Outcome } from '@/lib/domain'
import type { ScoreSignals } from '@/lib/queue/dynamicScore'
import {
  GATEKEEPER_PENALTY_CAP,
  GATEKEEPER_PENALTY_EACH,
  INTENT_BONUS,
  INTERESTED_BONUS,
  MEETING_BOOKED_BONUS,
  NO_ANSWER_PENALTY_CAP,
  NO_ANSWER_PENALTY_EACH,
} from '@/lib/queue/weights'

export interface ScoreLine {
  label: string
  points: number
}

export interface ScoreBreakdown {
  lines: ScoreLine[]
  total: number
}

export function scoreBreakdown(base: number, signals: ScoreSignals): ScoreBreakdown {
  const lines: ScoreLine[] = [{ label: 'Base score', points: base }]
  if (signals.intent) lines.push({ label: 'Buying intent signal', points: INTENT_BONUS })
  if (signals.outcomes.includes('interested')) {
    lines.push({ label: 'Interested on a past call', points: INTERESTED_BONUS })
  }
  if (signals.outcomes.includes('meeting_booked')) lines.push({ label: 'Meeting booked', points: MEETING_BOOKED_BONUS })
  addPenalty(lines, signals.outcomes, 'gatekeeper', 'Gatekeeper', GATEKEEPER_PENALTY_EACH, GATEKEEPER_PENALTY_CAP)
  addPenalty(lines, signals.outcomes, 'no_answer', 'No answer', NO_ANSWER_PENALTY_EACH, NO_ANSWER_PENALTY_CAP)

  const total = lines.reduce((sum, line) => sum + line.points, 0)
  return { lines, total }
}

function addPenalty(
  lines: ScoreLine[],
  outcomes: Outcome[],
  outcome: Outcome,
  label: string,
  each: number,
  cap: number,
): void {
  const count = outcomes.filter((o) => o === outcome).length
  if (count === 0) return
  lines.push({ label: `${label} x${count}`, points: -Math.min(count * each, cap) })
}
