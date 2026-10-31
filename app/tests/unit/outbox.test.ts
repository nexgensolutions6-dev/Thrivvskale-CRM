/**
 * Unit tests for the offline outbox on fake-indexeddb: first in first out, a
 * failure stops the flush and keeps the order, and enqueuing the same clientId
 * twice keeps one op.
 */
import 'fake-indexeddb/auto'
import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import type { LogCallInput } from '@/lib/call/logCallInput'
import { createOutbox, type Outbox, type OutboxOp } from '@/lib/offline/outbox'

function op(clientId: string): OutboxOp {
  const payload: LogCallInput = {
    clientId,
    companyId: randomUUID(),
    contactPointId: randomUUID(),
    outcome: 'no_answer',
    durationSeconds: null,
    durationIsEstimate: false,
    mixUsed: ['en'],
    objectionIds: [],
  }
  return { clientId, type: 'logCall', payload }
}

let box: Outbox

beforeEach(() => {
  box = createOutbox(randomUUID())
})

describe('outbox', () => {
  it('flushes three ops in the order they were queued', async () => {
    for (const id of ['a', 'b', 'c']) await box.enqueue(op(id))
    const seen: string[] = []

    const result = await box.flush(async (queued) => {
      seen.push(queued.clientId)
    })

    expect(seen).toEqual(['a', 'b', 'c'])
    expect(result).toEqual({ sent: 3, failed: 0 })
    expect(await box.pending()).toEqual([])
  })

  it('stops at the first failure and keeps that op and the ones after it, in order', async () => {
    for (const id of ['a', 'b', 'c']) await box.enqueue(op(id))
    const seen: string[] = []

    const result = await box.flush(async (queued) => {
      seen.push(queued.clientId)
      if (queued.clientId === 'b') throw new Error('network down')
    })

    expect(seen).toEqual(['a', 'b'])
    expect(result).toEqual({ sent: 1, failed: 1 })
    expect((await box.pending()).map((queued) => queued.clientId)).toEqual(['b', 'c'])

    const retried: string[] = []
    await box.flush(async (queued) => {
      retried.push(queued.clientId)
    })
    expect(retried).toEqual(['b', 'c'])
  })

  it('keeps one op when the same clientId is queued twice (a double tap)', async () => {
    await box.enqueue(op('a'))
    await box.enqueue(op('a'))
    expect(await box.pending()).toHaveLength(1)
  })

  it('removes one stuck op by clientId', async () => {
    for (const id of ['a', 'b']) await box.enqueue(op(id))
    await box.remove('a')
    expect((await box.pending()).map((queued) => queued.clientId)).toEqual(['b'])
  })

  it('keeps separate queues per scope', async () => {
    const other = createOutbox(randomUUID())
    await box.enqueue(op('a'))
    expect(await other.pending()).toEqual([])
  })
})
