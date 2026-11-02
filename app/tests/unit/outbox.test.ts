/**
 * Unit tests for the offline outbox on fake-indexeddb: first in first out, a
 * transport failure stops the flush and keeps the order, a refusal moves the op
 * to the dead letters and lets the rest flow, the same clientId twice is one op.
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
  return { clientId, type: 'logCall', companyName: `Company ${clientId}`, payload }
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
    expect(result).toEqual({ sent: 3, failed: 0, refused: 0 })
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
    expect(result).toEqual({ sent: 1, failed: 1, refused: 0 })
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

  it('keeps separate queues per scope', async () => {
    const other = createOutbox(randomUUID())
    await box.enqueue(op('a'))
    expect(await other.pending()).toEqual([])
  })

  it('moves a refused op to the dead letters and keeps sending the rest in order', async () => {
    for (const id of ['a', 'b', 'c']) await box.enqueue(op(id))
    const seen: string[] = []

    const result = await box.flush(async (queued) => {
      seen.push(queued.clientId)
      if (queued.clientId === 'b') return { refused: 'not its number' }
    })

    expect(seen).toEqual(['a', 'b', 'c'])
    expect(result).toEqual({ sent: 2, failed: 0, refused: 1 })
    expect(await box.pending()).toEqual([])
    const [dead, ...others] = await box.deadLetters()
    expect(others).toEqual([])
    expect(dead).toMatchObject({ clientId: 'b', companyName: 'Company b', reason: 'not its number' })
    expect(dead.payload.outcome).toBe('no_answer')
    expect(Date.parse(dead.refusedAt)).not.toBeNaN()
  })

  it('stops at a transport failure after a refusal, keeping both results', async () => {
    for (const id of ['a', 'b', 'c']) await box.enqueue(op(id))
    const result = await box.flush(async (queued) => {
      if (queued.clientId === 'a') return { refused: 'no' }
      throw new Error('network down')
    })
    expect(result).toEqual({ sent: 0, failed: 1, refused: 1 })
    expect((await box.pending()).map((queued) => queued.clientId)).toEqual(['b', 'c'])
  })

  it('never writes a dead letter on a transport failure', async () => {
    await box.enqueue(op('a'))
    await box.flush(async () => {
      throw new Error('session expired')
    })
    expect(await box.deadLetters()).toEqual([])
    expect(await box.pending()).toHaveLength(1)
  })

  it('removes one dead letter and nothing else', async () => {
    for (const id of ['a', 'b']) await box.enqueue(op(id))
    await box.flush(async () => ({ refused: 'no' }))
    await box.removeDeadLetter('a')
    expect((await box.deadLetters()).map((entry) => entry.clientId)).toEqual(['b'])
  })

  it('offers no way to delete an op that is still waiting', () => {
    expect(box).not.toHaveProperty('remove')
  })

  it('keeps the ops of a database created before the dead-letter store', async () => {
    const scope = randomUUID()
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(`thrivvskale-outbox-${scope}`, 1)
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore('ops', { keyPath: 'seq', autoIncrement: true })
        store.createIndex('clientId', 'clientId', { unique: true })
        store.add(op('old'))
      }
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        request.result.close()
        resolve()
      }
    })

    const upgraded = createOutbox(scope)
    expect((await upgraded.pending()).map((queued) => queued.clientId)).toEqual(['old'])
    expect(await upgraded.deadLetters()).toEqual([])
  })
})
