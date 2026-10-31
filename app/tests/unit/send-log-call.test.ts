/**
 * Unit tests for sendLogCall: how one server reply counts for the outbox. Only a
 * clear ok removes an op. A session redirect during a flush gives a throw or an
 * empty reply, which must count as transport, never as sent and never as refused.
 */
import { describe, expect, it } from 'vitest'
import type { LogCallInput, LogCallOutcome } from '@/lib/call/logCallInput'
import type { OutboxOp } from '@/lib/offline/outbox'
import { sendLogCall } from '@/lib/offline/sendLogCall'

const OP = {
  clientId: 'a', type: 'logCall', companyName: 'Acme', payload: { companyId: 'c' } as LogCallInput,
} satisfies OutboxOp

const replying = (reply: unknown) => async () => reply as LogCallOutcome

describe('sendLogCall', () => {
  it('counts an ok reply as sent', async () => {
    await expect(sendLogCall(OP, replying({ ok: true, callId: 'x', duplicate: false }))).resolves.toBeUndefined()
  })

  it('counts a duplicate as sent', async () => {
    await expect(sendLogCall(OP, replying({ ok: true, callId: 'x', duplicate: true }))).resolves.toBeUndefined()
  })

  it('hands back the reason of a refusal', async () => {
    const reply = { ok: false, refused: true, reason: 'not its number' }
    await expect(sendLogCall(OP, replying(reply))).resolves.toEqual({ refused: 'not its number' })
  })

  it.each([[undefined], [null], ['<html>login</html>'], [{}], [{ ok: false }]])(
    'treats the unusable reply %j as a transport failure, naming the company',
    async (reply) => {
      await expect(sendLogCall(OP, replying(reply))).rejects.toThrow(/sendLogCall.*Acme/)
    },
  )

  it('lets a thrown failure through as transport', async () => {
    const down = async (): Promise<LogCallOutcome> => {
      throw new Error('NEXT_REDIRECT')
    }
    await expect(sendLogCall(OP, down)).rejects.toThrow('NEXT_REDIRECT')
  })
})
