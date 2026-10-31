/**
 * The result a lead form action hands back to its form: ok, or a message to
 * show. `failureResult` logs the full error on the server (module and step
 * are in its message) and returns the message. Used by the saveContact and
 * addNote server actions and their forms.
 */
export type ActionResult = { ok: true } | { ok: false; message: string }

export function failureResult(action: string, error: unknown): ActionResult {
  const message = error instanceof Error ? error.message : 'Something went wrong.'
  console.error(`[${action}] ${message}`, error)
  return { ok: false, message }
}
