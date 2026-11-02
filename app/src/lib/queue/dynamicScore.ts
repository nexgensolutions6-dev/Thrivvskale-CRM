/**
 * Turns a base score plus intent and past call outcomes into the score used
 * for queue ranking. Pure arithmetic; the numbers live in weights.ts.
 * Called by the data-loading layer when it builds QueueItems.
 */
import type { Outcome } from '@/lib/domain'
import { stepError } from '@/lib/step-error'
import {
  GATEKEEPER_PENALTY_CAP,
  GATEKEEPER_PENALTY_EACH,
  INTENT_BONUS,
  INTERESTED_BONUS,
  MEETING_BOOKED_BONUS,
  NO_ANSWER_PENALTY_CAP,
  NO_ANSWER_PENALTY_EACH,
} from './weights'

export type ScoreSignals = { intent: boolean; outcomes: Outcome[] }

export function dynamicScore(base: number, signals: ScoreSignals): number {
  if (!Number.isFinite(base)) {
    throw stepError('queue/dynamicScore', 'check base score', `base must be a finite number, got ${base}`)
  }

  const { intent, outcomes } = signals
  let score = base

  if (intent) score += INTENT_BONUS
  if (outcomes.includes('interested')) score += INTERESTED_BONUS
  if (outcomes.includes('meeting_booked')) score += MEETING_BOOKED_BONUS

  score -= cappedPenalty(count(outcomes, 'gatekeeper'), GATEKEEPER_PENALTY_EACH, GATEKEEPER_PENALTY_CAP)
  score -= cappedPenalty(count(outcomes, 'no_answer'), NO_ANSWER_PENALTY_EACH, NO_ANSWER_PENALTY_CAP)

  return score
}

function count(outcomes: Outcome[], wanted: Outcome): number {
  return outcomes.filter((outcome) => outcome === wanted).length
}

function cappedPenalty(occurrences: number, each: number, cap: number): number {
  return Math.min(occurrences * each, cap)
}
