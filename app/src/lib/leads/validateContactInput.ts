/**
 * Runtime check of the contact form input (server actions are publicly
 * callable, TS types are not enforced). Returns trimmed, length-capped values
 * with the phone normalised and the language mix parsed, or throws naming the
 * bad field. Called by saveContact before any database work.
 */
import { CONTACT_ROLES, type ContactRole, type Mix } from '@/lib/domain'
import { normalizePhone, type NormalizedPhone } from '@/lib/phone'
import { stepError } from '@/lib/step-error'
import { parseMixText } from './contactMix'
import { isUuid } from './isUuid'

const MODULE = 'validateContactInput'
const MAX_NAME = 120
const MAX_NOTES = 2000

export interface ValidContactInput {
  companyId: string
  /** Set when editing an existing contact. */
  contactId: string | null
  name: string | null
  nameLatin: string | null
  role: ContactRole
  mix: Mix
  phone: NormalizedPhone | null
  notes: string | null
}

export function validateContactInput(input: unknown): ValidContactInput {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw stepError(MODULE, 'validate input', `input must be an object, got ${JSON.stringify(input)}`)
  }
  const raw = input as Record<string, unknown>

  const companyId = raw.companyId
  if (!isUuid(companyId)) {
    throw stepError(MODULE, 'validate companyId', `companyId must be a uuid string, got ${JSON.stringify(companyId)}`)
  }
  const contactId = raw.contactId ?? null
  if (contactId !== null && !isUuid(contactId)) {
    throw stepError(MODULE, 'validate contactId', `contactId must be a uuid string, got ${JSON.stringify(contactId)}`)
  }

  const name = readText(raw, 'name', MAX_NAME)
  const nameLatin = readText(raw, 'nameLatin', MAX_NAME)
  const notes = readText(raw, 'notes', MAX_NOTES)
  const role = readRole(raw.role)
  const mix = readMix(raw.languages)
  const phone = readPhone(raw.phone)

  if (name === null && nameLatin === null && phone === null) {
    throw stepError(MODULE, 'validate input', 'give at least one of name, nameLatin or phone')
  }
  return { companyId, contactId, name, nameLatin, role, mix, phone, notes }
}

/** Missing or blank is null; other types, long text and control characters are errors. */
function readText(raw: Record<string, unknown>, key: string, maxLength: number): string | null {
  const value = raw[key]
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') {
    throw stepError(MODULE, `validate ${key}`, `${key} must be a string, got ${typeof value}`)
  }
  const trimmed = value.trim()
  if (trimmed === '') return null
  if (trimmed.length > maxLength) {
    const detail = `${key} is too long (max ${maxLength} characters, got ${trimmed.length})`
    throw stepError(MODULE, `validate ${key}`, detail)
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(trimmed)) {
    throw stepError(MODULE, `validate ${key}`, `${key} contains a control character`)
  }
  return trimmed
}

function readRole(value: unknown): ContactRole {
  if (value === undefined || value === null || value === '') return 'other'
  const role = CONTACT_ROLES.find((candidate) => candidate === value)
  if (role === undefined) {
    const allowed = CONTACT_ROLES.join(', ')
    throw stepError(MODULE, 'validate role', `role must be one of ${allowed}, got ${JSON.stringify(value)}`)
  }
  return role
}

function readMix(value: unknown): Mix {
  if (value === undefined || value === null) return []
  if (typeof value !== 'string') {
    throw stepError(MODULE, 'validate languages', `languages must be text like "te+en", got ${typeof value}`)
  }
  try {
    return parseMixText(value)
  } catch (error) {
    throw stepError(MODULE, 'validate languages', error)
  }
}

function readPhone(value: unknown): NormalizedPhone | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') {
    throw stepError(MODULE, 'validate phone', `phone must be a string, got ${typeof value}`)
  }
  if (value.trim() === '') return null
  const phone = normalizePhone(value)
  if (phone === null) {
    throw stepError(MODULE, 'validate phone', `phone ${JSON.stringify(value)} is not an Indian phone number`)
  }
  return phone
}
