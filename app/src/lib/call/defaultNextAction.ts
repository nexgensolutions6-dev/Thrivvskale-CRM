/**
 * The next action the outcome sheet pre-selects for each outcome, so most
 * outcomes take two taps and no follow-up is lost. A lead with nothing scheduled
 * leaves the queue. The user can change it. Used by OutcomeSheet.
 */
import type { Outcome } from '@/lib/domain'
import type { NextActionType } from './logCallInput'

const DEFAULTS: Record<Outcome, NextActionType | null> = {
  no_answer: 'callback',
  busy: 'callback',
  callback: 'callback',
  gatekeeper: 'callback',
  interested: 'callback',
  meeting_booked: 'todo',
  not_interested: null,
  wrong_number: null,
}

export function defaultNextActionType(outcome: Outcome): NextActionType | null {
  return DEFAULTS[outcome]
}
