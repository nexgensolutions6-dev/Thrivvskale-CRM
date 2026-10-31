/**
 * The IndexedDB plumbing under the outbox: opens the database, runs one request
 * in its own transaction, and moves an op to the dead letters in one transaction
 * so a refused outcome is never in both stores or in neither. Used by outbox.ts.
 */
import { stepError } from '@/lib/step-error'

const MODULE = 'outboxDb'
const DB_VERSION = 2
const SEQUENCE_KEY = 'seq'
const DEAD_LETTER_KEY = 'clientId'

export const OPS_STORE = 'ops'
export const DEAD_LETTER_STORE = 'dead-letters'
export const CLIENT_ID_INDEX = 'clientId'

export function openDatabase(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(OPS_STORE)) {
        const store = db.createObjectStore(OPS_STORE, { keyPath: SEQUENCE_KEY, autoIncrement: true })
        store.createIndex(CLIENT_ID_INDEX, CLIENT_ID_INDEX, { unique: true })
      }
      if (!db.objectStoreNames.contains(DEAD_LETTER_STORE)) {
        db.createObjectStore(DEAD_LETTER_STORE, { keyPath: DEAD_LETTER_KEY })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(stepError(MODULE, `open database ${name}`, request.error))
  })
}

function settle(transaction: IDBTransaction, step: string, done: () => void, reject: (error: Error) => void): void {
  transaction.oncomplete = done
  transaction.onerror = () => reject(stepError(MODULE, step, transaction.error))
  transaction.onabort = () => reject(stepError(MODULE, step, transaction.error))
}

/** Runs one request in its own transaction and resolves once that transaction has committed. */
export function run<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  step: string,
  makeRequest: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    const request = makeRequest(transaction.objectStore(storeName))
    settle(transaction, step, () => resolve(request.result), reject)
  })
}

/** Deletes the op at `seq` and stores `letter`, both or neither. */
export function moveToDeadLetters(db: IDBDatabase, seq: number, letter: object, step: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([OPS_STORE, DEAD_LETTER_STORE], 'readwrite')
    transaction.objectStore(OPS_STORE).delete(seq)
    transaction.objectStore(DEAD_LETTER_STORE).put(letter)
    settle(transaction, step, resolve, reject)
  })
}
