/**
 * The shape of one logged call, shared by the outcome sheet, the offline outbox,
 * the logCall server action and validateLogCallInput. Types only, plus the lists
 * the runtime validator checks against.
 */
import type { Mix, Outcome } from '@/lib/domain'

export const OUTCOMES: readonly Outcome[] = [
  'no_answer', 'busy', 'wrong_number', 'callback', 'gatekeeper', 'interested', 'not_interested', 'meeting_booked',
]

export const IMPACTS = ['time', 'money', 'manpower'] as const
export type Impact = (typeof IMPACTS)[number]

export const NEXT_ACTION_TYPES = ['callback', 'todo'] as const
export type NextActionType = (typeof NEXT_ACTION_TYPES)[number]

export type PainPointInput = {
  processCategory: string
  currentTool?: string
  impact: Impact
  severity: 1 | 2 | 3 | 4 | 5
  /** Verbatim, original mixed-language text. */
  quote?: string
}

export type NextActionInput = { type: NextActionType; dueAt: string }

export type LogCallInput = {
  /** Generated once per call on the device; retrying with it never adds a second call. */
  clientId: string
  companyId: string
  contactPointId: string
  outcome: Outcome
  durationSeconds: number | null
  durationIsEstimate: boolean
  mixUsed: Mix
  objectionIds: string[]
  lostReason?: string
  openerId?: string
  painPoint?: PainPointInput
  nextAction?: NextActionInput
  /** When the call happened. Set by the sheet so an outcome sent later keeps its real time. */
  occurredAt?: string
}

export type LogCallResult = { callId: string; duplicate: boolean }
