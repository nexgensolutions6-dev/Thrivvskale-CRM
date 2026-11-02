/**
 * Builds the Error thrown when one step of a larger job fails, so every
 * message reads "[module] step failed: reason" and points straight at the
 * file and the line of code to look at. Called by the workspace, auth and
 * Supabase modules; the original error is kept as `cause`.
 */
export function stepError(module: string, step: string, cause: unknown): Error {
  return new Error(`[${module}] ${step} failed: ${describeCause(cause)}`, { cause })
}

/** Turns whatever was thrown (Error, Supabase error object, string) into text. */
function describeCause(cause: unknown): string {
  if (typeof cause === 'string') return cause
  if (typeof cause === 'object' && cause !== null && 'message' in cause) {
    const { message, code } = cause as { message: unknown; code?: unknown }
    return code ? `${String(message)} (code ${String(code)})` : String(message)
  }
  return 'unknown error'
}
