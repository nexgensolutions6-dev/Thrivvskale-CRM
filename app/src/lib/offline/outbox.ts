/**
 * The offline outbox: call outcomes waiting to reach the server, kept in the
 * browser's IndexedDB so a dropped signal or closed tab never loses a log. First
 * in, first out; a flush stops at the first failure and keeps the order. Retrying
 * is safe because logCall is idempotent on clientId. Used by useOutbox.
 */
import type { LogCallInput } from '@/lib/call/logCallInput'
import { stepError } from '@/lib/step-error'

const MODULE = 'offline/outbox'
const DB_PREFIX = 'thrivvskale-outbox'
const DB_VERSION = 1
const STORE = 'ops'
const SEQUENCE_KEY = 'seq'
const CLIENT_ID_INDEX = 'clientId'

export type OutboxOp = { clientId: string; type: 'logCall'; payload: LogCallInput }

type StoredOp = OutboxOp & { seq: number }

export interface Outbox {
  /** Adds an op at the back of the queue. The same clientId twice is one op. */
  enqueue(op: OutboxOp): Promise<void>
  flush(send: (op: OutboxOp) => Promise<void>): Promise<{ sent: number; failed: number }>
  /** Every waiting op, oldest first. */
  pending(): Promise<OutboxOp[]>
  /** Drops one op; for an outcome the server keeps refusing. */
  remove(clientId: string): Promise<void>
}

function openDatabase(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, DB_VERSION)
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: SEQUENCE_KEY, autoIncrement: true })
      store.createIndex(CLIENT_ID_INDEX, CLIENT_ID_INDEX, { unique: true })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(stepError(MODULE, `open database ${name}`, request.error))
  })
}

/** Runs one request in its own transaction and resolves once that transaction has committed. */
function run<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  step: string,
  makeRequest: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode)
    const request = makeRequest(transaction.objectStore(STORE))
    transaction.oncomplete = () => resolve(request.result)
    transaction.onerror = () => reject(stepError(MODULE, step, transaction.error))
    transaction.onabort = () => reject(stepError(MODULE, step, transaction.error))
  })
}

function withoutSeq({ clientId, type, payload }: StoredOp): OutboxOp {
  return { clientId, type, payload }
}

/** One outbox per scope (the workspace id), so two accounts on a device never send each other's calls. */
export function createOutbox(scope: string): Outbox {
  const databaseName = `${DB_PREFIX}-${scope}`
  let opened: Promise<IDBDatabase> | null = null
  const database = () => (opened ??= openDatabase(databaseName))

  async function oldest(db: IDBDatabase): Promise<StoredOp | undefined> {
    const cursor = await run(db, 'readonly', 'read oldest op', (store) => store.getAll(undefined, 1))
    return cursor[0] as StoredOp | undefined
  }

  async function enqueue(op: OutboxOp): Promise<void> {
    const db = await database()
    const seen = await run(db, 'readonly', `look for ${op.clientId}`, (store) =>
      store.index(CLIENT_ID_INDEX).count(op.clientId),
    )
    if (seen > 0) return
    await run(db, 'readwrite', `enqueue ${op.clientId}`, (store) => store.add(op))
  }

  async function flush(send: (op: OutboxOp) => Promise<void>): Promise<{ sent: number; failed: number }> {
    const db = await database()
    let sent = 0
    for (;;) {
      const head = await oldest(db)
      if (!head) return { sent, failed: 0 }
      try {
        await send(withoutSeq(head))
      } catch (error) {
        console.warn(`[${MODULE}] send ${head.clientId} failed, keeping it queued:`, error)
        return { sent, failed: 1 }
      }
      await run(db, 'readwrite', `remove sent op ${head.clientId}`, (store) => store.delete(head.seq))
      sent++
    }
  }

  async function pending(): Promise<OutboxOp[]> {
    const db = await database()
    const rows = await run(db, 'readonly', 'read waiting ops', (store) => store.getAll())
    return (rows as StoredOp[]).map(withoutSeq)
  }

  async function remove(clientId: string): Promise<void> {
    const db = await database()
    const key = await run(db, 'readonly', `find ${clientId}`, (store) =>
      store.index(CLIENT_ID_INDEX).getKey(clientId),
    )
    if (key !== undefined) await run(db, 'readwrite', `remove ${clientId}`, (store) => store.delete(key))
  }

  return { enqueue, flush, pending, remove }
}
