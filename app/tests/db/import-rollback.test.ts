import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { importLeads } from '@/lib/import/importLeads'
import { mapLeadRow } from '@/lib/import/mapLeadRow'
import { parseLeadsCsv } from '@/lib/import/parseLeadsCsv'
import { cleanup, createUserWithWorkspace, localStack, type LocalStack, type TestUser } from './support'

// Lets one test make the phone-number step fail; every other call runs the real step.
const phoneStep = vi.hoisted(() => ({ failNext: false }))
vi.mock('@/lib/import/writePhonePoints', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/import/writePhonePoints')>()
  return {
    writePhonePoints: async (...args: Parameters<typeof real.writePhonePoints>) => {
      if (phoneStep.failNext) {
        phoneStep.failNext = false
        throw new Error('[writePhonePoints] insert failed: simulated outage')
      }
      return real.writePhonePoints(...args)
    },
  }
})

const SETUP_TIMEOUT = 120_000
const SAMPLE_CSV = readFileSync(new URL('../fixtures/leads-sample.csv', import.meta.url), 'utf8')

let stack: LocalStack
let user: TestUser

beforeAll(async () => {
  stack = localStack()
  user = await createUserWithWorkspace(stack, 'import-rollback')
}, SETUP_TIMEOUT)

afterAll(async () => {
  if (stack && user) await cleanup(stack, [user])
}, SETUP_TIMEOUT)

function importRows(rawRows: Record<string, string>[]) {
  return importLeads(user.client, user.workspaceId, rawRows.map(mapLeadRow), rawRows)
}

async function countCompanies(): Promise<number> {
  const result = await user.client.from('companies').select('*', { count: 'exact', head: true })
  if (result.error) throw result.error
  return result.count ?? 0
}

describe('importLeads: a failure part-way', () => {
  it('removes the companies it inserted, and a retry then makes exactly one company per lead', async () => {
    const [template] = parseLeadsCsv(SAMPLE_CSV)
    // Phone-bearing leads with no website: after a failed run they could not be matched again.
    const rows = ['Rollback One', 'Rollback Two', 'Rollback Three'].map((name, position) => ({
      ...template,
      'Company Name': name,
      Phone: `+91900000010${position}`,
      'WhatsApp (verified)': '',
      Website: '',
    }))

    phoneStep.failNext = true
    await expect(importRows(rows)).rejects.toThrow(/rolled back: 3 new companies removed.*simulated outage/)
    expect(await countCompanies()).toBe(0)
    const openers = await user.client.from('content_variants').select('*', { count: 'exact', head: true })
    expect(openers.count).toBe(0)
    const stray = await user.client.from('import_rows').select('*', { count: 'exact', head: true })
    expect(stray.count).toBe(0)

    const retry = await importRows(rows)

    expect(retry).toMatchObject({ inserted: 3, updated: 0 })
    expect(await countCompanies()).toBe(3)
    const points = await user.client.from('contact_points').select('e164')
    expect(points.data).toHaveLength(3)
  }, SETUP_TIMEOUT)
})
