/**
 * The outcomes where the right person was really spoken to (the same set the
 * scoreboard counts as conversations). Only these teach us a contact's language
 * mix; a no-answer or a gatekeeper says nothing about it. Used by nextContactMix.
 */
import type { Outcome } from '@/lib/domain'

export const CONVERSATION_OUTCOMES: readonly Outcome[] = ['callback', 'interested', 'not_interested', 'meeting_booked']
