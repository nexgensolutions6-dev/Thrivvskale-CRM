/**
 * The offline outbox: call outcomes waiting to reach the server, kept in the
 * browser's IndexedDB so a dropped signal or closed tab never loses a log. First
 * in, first out. A transport failure stops the flush and keeps the order; a
 * refusal moves that op to the dead letters and the rest flow. Retrying is safe
 * because logCall is idempotent on clientId. Used by useOutbox.
 */
import type { LogCallInput } from '@/lib/call/logCallInput'
import {
  CLIENT_ID_INDEX,
  DEAD_LETTER_STORE,
  OPS_STORE,
  moveToDeadLetters,
  openDatabase,
  run,
} from './outboxDb'

const MODULE = 'outbox'
const DB_PREFIX = 'thrivvskale-outbox'

export type OutboxOp = {
  clientId: string
  type: 'logCall'
  /** Kept with the op so a refusal can name the company without the server. */
  companyName: string
  payload: LogCallInput
}

/** An op the server refused for good. Only the user can remove it. */
export type DeadLetter = OutboxOp & { reason: string; refusedAt: string }

/** What `send` answers: nothing when sent, `{ refused }` for a permanent no. Throwing means try again later. */
export type SendResult = { refused: string } | void

export type FlushResult = { sent: number; failed: number; refused: number }

type StoredOp = OutboxOp & { seq: number }

export interface Outbox {
  /** Adds an op at the back of the queue. The same clientId twice is one op. */
  enqueue(op: OutboxOp): Promise<void>
  flush(send: (op: OutboxOp) => Promise<SendResult>): Promise<FlushResult>
  /** Every waiting op, oldest first. */
  pending(): Promise<OutboxOp[]>
  /** Every refused op, for the user to read. */
  deadLetters(): Promise<DeadLetter[]>
  /** Drops one refused op, after the user confirmed it by name. */
  removeDeadLetter(clientId: string): Promise<void>
}

function withoutSeq({ clientId, type, companyName, payload }: StoredOp): OutboxOp {
  return { clientId, type, companyName, payload }
}

/** One outbox per scope (the workspace id), so two accounts on a device never send each other's calls. */
export function createOutbox(scope: string): Outbox {
  const databaseName = `${DB_PREFIX}-${scope}`
  let opened: Promise<IDBDatabase> | null = null
  const database = () => (opened ??= openDatabase(databaseName))

  async function oldest(db: IDBDatabase): Promise<StoredOp | undefined> {
    const rows = await run(db, OPS_STORE, 'readonly', 'read oldest op', (store) => store.getAll(undefined, 1))
    return rows[0] as StoredOp | undefined
  }

  async function enqueue(op: OutboxOp): Promise<void> {
    const db = await database()
    const seen = await run(db, OPS_STORE, 'readonly', `look for ${op.clientId}`, (store) =>
      store.index(CLIENT_ID_INDEX).count(op.clientId),
    )
    if (seen > 0) return
    await run(db, OPS_STORE, 'readwrite', `enqueue ${op.clientId}`, (store) => store.add(op))
  }

  async function flush(send: (op: OutboxOp) => Promise<SendResult>): Promise<FlushResult> {
    const db = await database()
    let sent = 0
    let refused = 0
    for (;;) {
      const head = await oldest(db)
      if (!head) return { sent, failed: 0, refused }
      let result: SendResult
      try {
        result = await send(withoutSeq(head))
      } catch (error) {
        console.warn(`[${MODULE}] send to "${head.companyName}" (${head.clientId}) failed, keeping it queued:`, error)
        return { sent, failed: 1, refused }
      }
      if (result) {
        const letter: DeadLetter = {
          ...withoutSeq(head),
          reason: result.refused,
          refusedAt: new Date().toISOString(),
        }
        await moveToDeadLetters(db, head.seq, letter, `move refused op for "${head.companyName}"`)
        refused++
        continue
      }
      await run(db, OPS_STORE, 'readwrite', `remove sent op ${head.clientId}`, (store) => store.delete(head.seq))
      sent++
    }
  }

  async function pending(): Promise<OutboxOp[]> {
    const db = await database()
    const rows = await run(db, OPS_STORE, 'readonly', 'read waiting ops', (store) => store.getAll())
    return (rows as StoredOp[]).map(withoutSeq)
  }

  async function deadLetters(): Promise<DeadLetter[]> {
    const db = await database()
    const rows = await run(db, DEAD_LETTER_STORE, 'readonly', 'read dead letters', (store) => store.getAll())
    return rows as DeadLetter[]
  }

  async function removeDeadLetter(clientId: string): Promise<void> {
    const db = await database()
    await run(db, DEAD_LETTER_STORE, 'readwrite', `remove dead letter ${clientId}`, (store) => store.delete(clientId))
  }

  return { enqueue, flush, pending, deadLetters, removeDeadLetter }
}
