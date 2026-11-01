/**
 * Runtime check of the targets form: each value must be a whole number from 0
 * to MAX_TARGET. Messages are written for the person using the form (no ids,
 * modules or database text). Called by saveTargets.
 */
import type { TargetValues } from './types'

export const MAX_TARGET = 1000

/** A value the person typed was not acceptable; the message is safe to show as is. */
export class TargetsInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TargetsInputError'
  }
}

const FIELDS: ReadonlyArray<readonly [keyof TargetValues, string]> = [
  ['calls', 'Calls per day'],
  ['conversations', 'Conversations per day'],
  ['demos', 'Demos per day'],
]

function parseCount(value: unknown, label: string): number {
  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : ''
  if (!/^\d+$/.test(text)) throw new TargetsInputError(`${label} must be a whole number, 0 or more.`)
  const count = Number(text)
  if (count > MAX_TARGET) throw new TargetsInputError(`${label} can be at most ${MAX_TARGET}.`)
  return count
}

export function validateTargets(raw: unknown): TargetValues {
  if (typeof raw !== 'object' || raw === null) throw new TargetsInputError('The targets were not sent. Please try again.')
  const record = raw as Record<string, unknown>
  const [calls, conversations, demos] = FIELDS.map(([key, label]) => parseCount(record[key], label))
  return { calls, conversations, demos }
}
