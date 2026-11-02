/**
 * The words the call screens show for outcomes and languages. Used by
 * OutcomeSheet and MixChips.
 */
import type { LangCode, Outcome } from '@/lib/domain'

export const OUTCOME_LABELS: Record<Outcome, string> = {
  no_answer: 'No answer',
  busy: 'Busy',
  wrong_number: 'Wrong number',
  callback: 'Callback',
  gatekeeper: 'Gatekeeper',
  interested: 'Interested',
  not_interested: 'Not interested',
  meeting_booked: 'Meeting booked',
}

export const LANGUAGE_LABELS: Record<LangCode, string> = {
  te: 'Telugu',
  hi: 'Hindi',
  kn: 'Kannada',
  ta: 'Tamil',
  ml: 'Malayalam',
  mr: 'Marathi',
  ur: 'Urdu',
  en: 'English',
}
