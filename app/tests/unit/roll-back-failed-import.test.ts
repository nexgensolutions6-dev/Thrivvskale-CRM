import { describe, expect, it } from 'vitest'
import type { ImportDb } from '@/lib/import/importDb'
import type { ImportPlan } from '@/lib/import/importPlan'
import { rollBackFailedImport } from '@/lib/import/rollBackFailedImport'

/** A db whose deletes all answer with the given error (or succeed when null). */
function fakeDb(deleteError: { message: string } | null): ImportDb {
  const query = { eq: () => query, in: async () => ({ error: deleteError }) }
  return { from: () => ({ delete: () => query }) } as unknown as ImportDb
}

const PLAN = {
  entries: [
    { companyId: 'new-1', isNew: true },
    { companyId: 'new-2', isNew: true },
    { companyId: 'old-1', isNew: false },
  ],
  knownPhones: new Set<string>(),
} as unknown as ImportPlan

describe('rollBackFailedImport', () => {
  it('throws an error saying the import was rolled back, naming the original failure', async () => {
    const result = rollBackFailedImport(fakeDb(null), 'ws', PLAN, new Error('[writePhonePoints] boom'))

    await expect(result).rejects.toThrow('rolled back: 2 new companies removed')
    await expect(result).rejects.toThrow('[writePhonePoints] boom')
  })

  it('says so clearly, with the count, when the rollback itself fails', async () => {
    const result = rollBackFailedImport(fakeDb({ message: 'rls denied' }), 'ws', PLAN, new Error('first failure'))

    await expect(result).rejects.toThrow('[rollBackFailedImport] roll back 2 new companies')
    await expect(result).rejects.toThrow('may remain')
    await expect(result).rejects.toThrow('rls denied')
  })
})
