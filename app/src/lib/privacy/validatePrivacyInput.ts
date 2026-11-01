/**
 * Runtime checks for the privacy actions' inputs. Server actions are publicly
 * callable and TypeScript types are erased, so ids must be uuids, dnd a real
 * boolean, the note a short string and visibility one of two words. Called by
 * setDnd, eraseContact, exportContact and setPointVisibility.
 */
import { isUuid } from '@/lib/leads/isUuid'
import { stepError } from '@/lib/step-error'

const MODULE = 'privacy/validate'
const NOTE_MAX = 500
export const VISIBILITIES = ['owner_only', 'workspace'] as const
export type PointVisibility = (typeof VISIBILITIES)[number]

export function requireId(field: string, value: unknown): string {
  if (!isUuid(value)) throw stepError(MODULE, `check ${field}`, 'not a uuid')
  return value
}

export function requireDnd(value: unknown): boolean {
  if (typeof value !== 'boolean') throw stepError(MODULE, 'check dnd', 'must be true or false')
  return value
}

/** Optional free-text reason for an opt-out; blank means none. */
export function optionalNote(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') throw stepError(MODULE, 'check note', 'must be text')
  const note = value.trim()
  if (note.length > NOTE_MAX) throw stepError(MODULE, 'check note', `longer than ${NOTE_MAX} characters`)
  return note === '' ? null : note
}

export function requireVisibility(value: unknown): PointVisibility {
  const match = VISIBILITIES.find((allowed) => allowed === value)
  if (!match) throw stepError(MODULE, 'check visibility', "must be 'owner_only' or 'workspace'")
  return match
}
