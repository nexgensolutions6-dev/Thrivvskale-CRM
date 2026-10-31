/**
 * Runtime check of the add-note inputs (server actions are publicly callable,
 * TS types are not enforced). Returns the trimmed note or throws naming the
 * bad value. Called by addNoteToCompany before any database work.
 */
import { stepError } from '@/lib/step-error'
import { isUuid } from './isUuid'

const MODULE = 'validateNoteInput'
export const MAX_NOTE_LENGTH = 2000

export function validateNoteInput(companyId: unknown, body: unknown): { companyId: string; body: string } {
  if (!isUuid(companyId)) {
    throw stepError(MODULE, 'validate companyId', `companyId must be a uuid string, got ${JSON.stringify(companyId)}`)
  }
  if (typeof body !== 'string') {
    throw stepError(MODULE, 'validate body', `body must be a string, got ${typeof body}`)
  }
  const trimmed = body.trim()
  if (trimmed === '') throw stepError(MODULE, 'validate body', 'body is empty')
  if (trimmed.length > MAX_NOTE_LENGTH) {
    const detail = `body is too long (max ${MAX_NOTE_LENGTH} characters, got ${trimmed.length})`
    throw stepError(MODULE, 'validate body', detail)
  }
  if (hasControlCharacter(trimmed)) throw stepError(MODULE, 'validate body', 'body contains a control character')
  return { companyId, body: trimmed }
}

/** Tabs and line breaks are fine in a note; other control characters (NUL breaks Postgres) are not. */
function hasControlCharacter(text: string): boolean {
  return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)
}
