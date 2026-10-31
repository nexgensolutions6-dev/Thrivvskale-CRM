/**
 * The words and the one decision behind the outbox notices. Stuck means the
 * transport is failing, so the op is retried and nothing destructive is offered.
 * A refusal alone is not stuck. Used by useOutbox, OutboxStatus and RefusedOutcomes.
 */
import { OUTCOME_LABELS } from '@/lib/call/outcomeLabels'
import type { DeadLetter, FlushResult } from './outbox'

export function isStuck(result: FlushResult): boolean {
  return result.failed > 0
}

export function waitingLabel(count: number): string {
  return count === 1 ? '1 outcome waiting to send' : `${count} outcomes waiting to send`
}

export function removeQuestion(letter: DeadLetter): string {
  const outcome = OUTCOME_LABELS[letter.payload.outcome]
  return `Remove the "${outcome}" outcome for ${letter.companyName}? This call will not be logged.`
}
