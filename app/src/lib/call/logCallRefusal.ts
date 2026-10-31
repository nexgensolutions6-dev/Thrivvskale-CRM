/**
 * Tells a permanent refusal of a call from a failure that may heal, and words each
 * refusal as one short fixed sentence (no ids, module names or database codes).
 * The full error is logged by the logCall server action. Used by that action.
 */
const MODULE = 'logCallRefusal'
const REFUSING_SQLSTATE = /^(P0001$|22|23)/ // raise exception, data exception, integrity constraint
const LOG_CALL_PREFIX = '[log_call]'
const FALLBACK_REASON = 'The server refused this call.'
const VALIDATED_FIELD = /validate ([A-Za-z.]+) failed/

/** First match wins; each pattern reads a fixed step name from our own messages. */
const REASONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/check membership/, 'You are not a member of this workspace.'],
  [/find company/, 'That lead is no longer in your workspace.'],
  [/find earlier call/, 'This call id is already used by another record.'],
  [/check contact point|read contact point/, "That number is not one of this lead's numbers."],
  [/check contact failed/, "That contact is not one of this lead's contacts."],
  [/check opener/, 'That opener cannot be used on this lead.'],
  [/check objections/, 'One of the objections is not available in your workspace.'],
]

function isPermanent(cause: unknown): boolean {
  if (typeof cause === 'string') return true
  if (typeof cause !== 'object' || cause === null) return false
  const { code, message } = cause as { code?: unknown; message?: unknown }
  if (typeof message === 'string' && message.startsWith(LOG_CALL_PREFIX)) return true
  return typeof code === 'string' && REFUSING_SQLSTATE.test(code)
}

/** Maps the raw refusal text to a safe sentence; unknown text gets the generic one. */
export function plainReason(raw: string): string {
  const found = REASONS.find(([pattern]) => pattern.test(raw))
  if (found) return found[1]
  const field = VALIDATED_FIELD.exec(raw)?.[1]
  return field ? `The ${field} of this call was not valid.` : FALLBACK_REASON
}

/** The reason to show when `error` is a refusal, or null when the call should be retried. */
export function refusalReason(error: unknown): string | null {
  if (!(error instanceof Error) || !isPermanent(error.cause)) return null
  const reason = plainReason(error.message)
  if (reason === FALLBACK_REASON) console.error(`[${MODULE}] refusal without a fixed reason`, error.message)
  return reason
}
