/**
 * Sends one outbox op and says how the reply counts: sent, refused, or a throw
 * that keeps it queued. Only a clear ok removes an op: a session redirect during
 * a flush gives no usable reply, which must never count as sent. Used by useOutbox.
 */
import type { LogCallInput, LogCallOutcome } from '@/lib/call/logCallInput'
import { stepError } from '@/lib/step-error'
import type { OutboxOp, SendResult } from './outbox'

const MODULE = 'sendLogCall'

export async function sendLogCall(
  op: OutboxOp,
  logCall: (input: LogCallInput) => Promise<LogCallOutcome>,
): Promise<SendResult> {
  const reply: Partial<Extract<LogCallOutcome, { ok: false }>> | { ok: true } | null | undefined =
    await logCall(op.payload)
  if (reply?.ok === true) return undefined
  if (reply?.ok === false && reply.refused === true && typeof reply.reason === 'string') {
    return { refused: reply.reason }
  }
  throw stepError(MODULE, `send the call on "${op.companyName}"`, 'no usable reply, the session may have expired')
}
