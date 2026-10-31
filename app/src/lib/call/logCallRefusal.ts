/**
 * Tells a permanent refusal of a call from a failure that may heal. A stepError
 * with a text cause is one of our own rules saying no; a database cause counts
 * only when retrying can never work. Everything else stays a transport failure,
 * which keeps its place in the outbox. Used by the logCall server action.
 */
const REFUSING_SQLSTATE = /^(P0001$|22|23)/ // raise exception, data exception, integrity constraint
const LOG_CALL_PREFIX = '[log_call]'

function isPermanent(cause: unknown): boolean {
  if (typeof cause === 'string') return true
  if (typeof cause !== 'object' || cause === null) return false
  const { code, message } = cause as { code?: unknown; message?: unknown }
  if (typeof message === 'string' && message.startsWith(LOG_CALL_PREFIX)) return true
  return typeof code === 'string' && REFUSING_SQLSTATE.test(code)
}

/** The reason to show when `error` is a refusal, or null when the call should be retried. */
export function refusalReason(error: unknown): string | null {
  return error instanceof Error && isPermanent(error.cause) ? error.message : null
}
