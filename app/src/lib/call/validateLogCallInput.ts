/**
 * Runtime check of a logCall input (server actions are publicly callable and
 * TS types are erased). Returns a clean copy with only the known fields, or
 * throws "[validateLogCallInput] validate <field> failed: ...". Whether the ids
 * belong to the workspace is checked by the log_call database function. Safe in
 * the browser too: buildPayload runs it before an outcome is queued.
 */
import { LANG_CODES, type LangCode, type Mix } from '@/lib/domain'
import { PROCESS_CATEGORIES } from '@/lib/discovery/taxonomy'
import { isUuid } from '@/lib/leads/isUuid'
import { stepError } from '@/lib/step-error'
import {
  IMPACTS,
  NEXT_ACTION_TYPES,
  OUTCOMES,
  type LogCallInput,
  type NextActionInput,
  type PainPointInput,
} from './logCallInput'

const MODULE = 'validateLogCallInput'
export const MAX_DURATION_SECONDS = 4 * 60 * 60
const MAX_REASON_LENGTH = 500
const MAX_TOOL_LENGTH = 200
const MAX_QUOTE_LENGTH = 2000
const MAX_OBJECTIONS = 20
const MIN_SEVERITY = 1
const MAX_SEVERITY = 5
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$/

type Fields = Record<string, unknown>

function bad(field: string, detail: string): Error {
  return stepError(MODULE, `validate ${field}`, detail)
}

function show(value: unknown): string {
  return JSON.stringify(value) ?? String(value)
}

function asObject(value: unknown, field: string): Fields {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw bad(field, `must be an object, got ${show(value)}`)
  }
  return value as Fields
}

function requireUuid(value: unknown, field: string): string {
  if (!isUuid(value)) throw bad(field, `must be a uuid, got ${show(value)}`)
  return value
}

function requireOneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw bad(field, `must be one of ${allowed.join(', ')}, got ${show(value)}`)
  }
  return value as T
}

function requireInstant(value: unknown, field: string): string {
  if (typeof value !== 'string' || !ISO_INSTANT.test(value) || Number.isNaN(Date.parse(value))) {
    throw bad(field, `must be an ISO date and time, got ${show(value)}`)
  }
  return value
}

function hasControlCharacter(text: string): boolean {
  return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)
}

/** Checks optional free text and returns it unchanged. Undefined and blank both mean "not given". */
function optionalText(value: unknown, field: string, max: number): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') throw bad(field, `must be text, got ${show(value)}`)
  if (value.length > max) throw bad(field, `is too long (max ${max} characters, got ${value.length})`)
  if (hasControlCharacter(value)) throw bad(field, 'contains a control character')
  return value.trim() === '' ? undefined : value
}

function validateDuration(raw: Fields): { durationSeconds: number | null; durationIsEstimate: boolean } {
  const seconds = raw.durationSeconds
  if (seconds !== null && (!Number.isInteger(seconds) || (seconds as number) < 0)) {
    throw bad('durationSeconds', `must be null or a whole number >= 0, got ${show(seconds)}`)
  }
  if (typeof seconds === 'number' && seconds > MAX_DURATION_SECONDS) {
    throw bad('durationSeconds', `must be at most ${MAX_DURATION_SECONDS}, got ${seconds}`)
  }
  if (typeof raw.durationIsEstimate !== 'boolean') {
    throw bad('durationIsEstimate', `must be true or false, got ${show(raw.durationIsEstimate)}`)
  }
  if (seconds === null && raw.durationIsEstimate) {
    throw bad('durationIsEstimate', 'cannot be true when there is no duration')
  }
  return { durationSeconds: seconds as number | null, durationIsEstimate: raw.durationIsEstimate }
}

/** An empty mix is allowed: nobody spoke on an unanswered call. */
function validateMix(value: unknown): Mix {
  if (!Array.isArray(value)) throw bad('mixUsed', `must be a list of language codes, got ${show(value)}`)
  const codes = value.map((code) => requireOneOf<LangCode>(code, LANG_CODES, 'mixUsed'))
  if (new Set(codes).size !== codes.length) throw bad('mixUsed', `has a repeated language: ${show(value)}`)
  return codes
}

function validateObjectionIds(value: unknown): string[] {
  if (!Array.isArray(value)) throw bad('objectionIds', `must be a list of uuids, got ${show(value)}`)
  if (value.length > MAX_OBJECTIONS) throw bad('objectionIds', `has more than ${MAX_OBJECTIONS} entries`)
  return [...new Set(value.map((id) => requireUuid(id, 'objectionIds')))]
}

function validatePainPoint(value: unknown): PainPointInput | undefined {
  if (value === undefined || value === null) return undefined
  const raw = asObject(value, 'painPoint')
  const severity = raw.severity
  if (!Number.isInteger(severity) || (severity as number) < MIN_SEVERITY || (severity as number) > MAX_SEVERITY) {
    throw bad('painPoint.severity', `must be a whole number from 1 to 5, got ${show(severity)}`)
  }
  return {
    processCategory: requireOneOf(raw.processCategory, PROCESS_CATEGORIES, 'painPoint.processCategory'),
    currentTool: optionalText(raw.currentTool, 'painPoint.currentTool', MAX_TOOL_LENGTH),
    impact: requireOneOf(raw.impact, IMPACTS, 'painPoint.impact'),
    severity: severity as PainPointInput['severity'],
    quote: optionalText(raw.quote, 'painPoint.quote', MAX_QUOTE_LENGTH),
  }
}

function validateNextAction(value: unknown, outcome: LogCallInput['outcome']): NextActionInput | undefined {
  if (value === undefined || value === null) {
    if (outcome === 'callback') throw bad('nextAction', 'a callback outcome needs a callback date')
    return undefined
  }
  const raw = asObject(value, 'nextAction')
  return {
    type: requireOneOf(raw.type, NEXT_ACTION_TYPES, 'nextAction.type'),
    dueAt: requireInstant(raw.dueAt, 'nextAction.dueAt'),
  }
}

export function validateLogCallInput(input: unknown): LogCallInput {
  const raw = asObject(input, 'input')
  const outcome = requireOneOf(raw.outcome, OUTCOMES, 'outcome')
  return {
    clientId: requireUuid(raw.clientId, 'clientId'),
    companyId: requireUuid(raw.companyId, 'companyId'),
    contactPointId: requireUuid(raw.contactPointId, 'contactPointId'),
    outcome,
    ...validateDuration(raw),
    mixUsed: validateMix(raw.mixUsed),
    objectionIds: validateObjectionIds(raw.objectionIds),
    lostReason: optionalText(raw.lostReason, 'lostReason', MAX_REASON_LENGTH)?.trim(),
    openerId: raw.openerId === undefined || raw.openerId === null ? undefined : requireUuid(raw.openerId, 'openerId'),
    painPoint: validatePainPoint(raw.painPoint),
    nextAction: validateNextAction(raw.nextAction, outcome),
    occurredAt: raw.occurredAt === undefined ? undefined : requireInstant(raw.occurredAt, 'occurredAt'),
  }
}
