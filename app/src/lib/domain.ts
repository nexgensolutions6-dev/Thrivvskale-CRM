/**
 * Shared domain vocabulary for the ThrivvSkale CRM.
 *
 * Pure types and helpers only: no I/O, no framework imports. Every later
 * module (import mapping, queue ranking, language engine, call logging)
 * builds on these definitions, so the string literals here must match the
 * database enums and the spec exactly.
 */

/** Lead tier: core verticals are called first, exploratory ones rank below. */
export type Tier = 'core' | 'exploratory'

export type Priority = 'A' | 'B' | 'C'

/** Who a contact is at the company. Matches the contact_role database enum. */
export type ContactRole = 'owner' | 'decision_maker' | 'manager' | 'gatekeeper' | 'other'

export const CONTACT_ROLES: readonly ContactRole[] = ['owner', 'decision_maker', 'manager', 'gatekeeper', 'other']

/** WhatsApp reachability of a phone number. Landlines never get a WhatsApp button. */
export type WaStatus = 'verified' | 'unconfirmed' | 'landline' | 'none'

/** Languages a contact can be spoken to in (ISO 639-1). */
export type LangCode = 'te' | 'hi' | 'kn' | 'ta' | 'ml' | 'mr' | 'ur' | 'en'

/** Every language code, in the order the database enum lists them. */
export const LANG_CODES: readonly LangCode[] = ['te', 'hi', 'kn', 'ta', 'ml', 'mr', 'ur', 'en']

/** An ordered set of languages, primary first, e.g. `['te', 'hi', 'en']`. */
export type Mix = LangCode[]

/** Writing system used for message text: Roman letters or the native script. */
export type Script = 'latin' | 'native'

export type Register = 'formal' | 'casual'

/** The only call outcomes the app records. */
export type Outcome =
  | 'no_answer'
  | 'busy'
  | 'wrong_number'
  | 'callback'
  | 'gatekeeper'
  | 'interested'
  | 'not_interested'
  | 'meeting_booked'

/** Verticals the business actively targets (tier `core`). */
export const CORE_VERTICALS: readonly string[] = [
  'Interiors & Modular',
  'Coaching & Education',
  'Clinics, Diagnostics & Pharmacies',
  'Manufacturing & Furniture',
]

const normalizeVertical = (v: string): string =>
  v.trim().replace(/\s+/g, ' ').toLowerCase()

const CORE_VERTICAL_KEYS: ReadonlySet<string> = new Set(
  CORE_VERTICALS.map(normalizeVertical),
)

/**
 * Tier for a vertical name (compared ignoring case and extra whitespace).
 * Anything not in {@link CORE_VERTICALS}, including the known exploratory
 * verticals (Real Estate & Construction, Automobile & Driving Schools) and
 * unknown values, is `exploratory`.
 */
export function tierForVertical(v: string): Tier {
  return CORE_VERTICAL_KEYS.has(normalizeVertical(v)) ? 'core' : 'exploratory'
}
