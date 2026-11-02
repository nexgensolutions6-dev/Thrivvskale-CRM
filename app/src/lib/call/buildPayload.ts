/**
 * Turns the outcome sheet's fields into the LogCallInput it queues, or a message
 * for the sheet. Runs the server's own validator first: once queued an outcome
 * can no longer be corrected, so anything the server would refuse stops here.
 * An over-long estimate is dropped, not refused. Used by OutcomeSheet.
 */
import type { Mix, Outcome } from '@/lib/domain'
import { fromLocalInput } from './localDateTime'
import type { LogCallInput, NextActionType, PainPointInput } from './logCallInput'
import { MAX_DURATION_SECONDS, validateLogCallInput } from './validateLogCallInput'

const LENGTH_MESSAGE = `Call length must be a whole number of seconds, from 0 to ${MAX_DURATION_SECONDS}.`
const DATE_MESSAGE = 'Choose a date for the next action.'
const VALIDATOR_FAILURE = /validate (\S+) failed: ([\s\S]*)$/

const FIELD_NAMES: Record<string, string> = {
  lostReason: 'Lost reason',
  'painPoint.quote': 'The pain point quote',
  'painPoint.currentTool': 'The current tool',
}

export interface CallDraft {
  clientId: string
  companyId: string
  contactPointId: string
  outcome: Outcome
  /** The call length field as typed; blank means no duration. */
  secondsText: string
  isEstimate: boolean
  mix: Mix
  objectionIds: string[]
  lostReason: string
  openerId: string | null
  painPoint: PainPointInput | undefined
  nextType: NextActionType | null
  /** The value of the datetime-local field. */
  nextDueLocal: string
  now: Date
}

export type BuiltPayload = { ok: true; payload: LogCallInput } | { ok: false; message: string }

/** An estimate over the maximum means the user simply came back late: the guess is meaningless. */
export function usableEstimate(seconds: number | null): number | null {
  return seconds !== null && seconds > MAX_DURATION_SECONDS ? null : seconds
}

type Duration = Pick<LogCallInput, 'durationSeconds' | 'durationIsEstimate'>

function readDuration(secondsText: string, isEstimate: boolean): Duration {
  const seconds = secondsText.trim() === '' ? null : Number(secondsText)
  if (isEstimate && usableEstimate(seconds) === null) return { durationSeconds: null, durationIsEstimate: false }
  return { durationSeconds: seconds, durationIsEstimate: seconds !== null && isEstimate }
}

function lengthIsValid(seconds: number | null): boolean {
  return seconds === null || (Number.isInteger(seconds) && seconds >= 0 && seconds <= MAX_DURATION_SECONDS)
}

/** The validator's message without its module prefix, in the words of the form. */
function sheetMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  const failure = VALIDATOR_FAILURE.exec(text)
  if (!failure) return text
  const [, field, detail] = failure
  return `${FIELD_NAMES[field] ?? field} ${detail}.`
}

export function buildPayload(draft: CallDraft): BuiltPayload {
  const { nextType } = draft
  const dueAt = nextType === null ? null : fromLocalInput(draft.nextDueLocal)
  if (nextType !== null && dueAt === null) return { ok: false, message: DATE_MESSAGE }
  const duration = readDuration(draft.secondsText, draft.isEstimate)
  if (!lengthIsValid(duration.durationSeconds)) return { ok: false, message: LENGTH_MESSAGE }

  try {
    const payload = validateLogCallInput({
      clientId: draft.clientId,
      companyId: draft.companyId,
      contactPointId: draft.contactPointId,
      outcome: draft.outcome,
      ...duration,
      mixUsed: draft.mix,
      objectionIds: draft.objectionIds,
      lostReason: draft.outcome === 'not_interested' ? draft.lostReason : undefined,
      openerId: draft.openerId ?? undefined,
      painPoint: draft.painPoint,
      nextAction: nextType !== null && dueAt !== null ? { type: nextType, dueAt } : undefined,
      occurredAt: draft.now.toISOString(),
    })
    return { ok: true, payload }
  } catch (error) {
    return { ok: false, message: sheetMessage(error) }
  }
}
