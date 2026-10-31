import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { importLeads } from '@/lib/import/importLeads'
import { mapLeadRow } from '@/lib/import/mapLeadRow'
import { parseLeadsCsv } from '@/lib/import/parseLeadsCsv'
import { loadLead } from '@/lib/leads/loadLead'
import { buildOpenerChoices } from '@/lib/leads/openerChoices'
import { cleanup, createUserWithWorkspace, localStack, type LocalStack, type TestUser } from './support'

const SETUP_TIMEOUT = 120_000
const SAMPLE_CSV = readFileSync(new URL('../fixtures/leads-sample.csv', import.meta.url), 'utf8')

let stack: LocalStack
const users: TestUser[] = []

beforeAll(() => {
  stack = localStack()
}, SETUP_TIMEOUT)

afterAll(async () => {
  if (stack) await cleanup(stack, users)
}, SETUP_TIMEOUT)

async function newUser(label: string): Promise<TestUser> {
  const user = await createUserWithWorkspace(stack, label)
  users.push(user)
  return user
}

function importRows(user: TestUser, rawRows: Record<string, string>[]) {
  return importLeads(user.client, user.workspaceId, rawRows.map(mapLeadRow), rawRows)
}

async function companyId(user: TestUser, name: string): Promise<string> {
  const found = await user.client.from('companies').select('id').eq('name', name).single()
  if (found.error) throw found.error
  return found.data.id
}

async function storedOpeners(user: TestUser) {
  const result = await user.client.from('content_variants').select('company_id, body, mix, script, kind').eq('kind', 'opener')
  if (result.error) throw result.error
  return result.data
}

const [DIVYANK, ABHINAV] = parseLeadsCsv(SAMPLE_CSV)
const DIVYANK_NAME = DIVYANK['Company Name']

describe('importLeads: call openers', () => {
  it('stores each CSV opener on its own company, once, and updates it when the CSV changes', async () => {
    const user = await newUser('opener-store')
    const rows = parseLeadsCsv(SAMPLE_CSV)
    await importRows(user, rows)

    const first = await storedOpeners(user)
    expect(first).toHaveLength(rows.filter((row) => row['Call Opener'].trim() !== '').length)
    const divyankId = await companyId(user, DIVYANK_NAME)
    expect(first.find((row) => row.company_id === divyankId)).toMatchObject({
      body: DIVYANK['Call Opener'].trim(), kind: 'opener', mix: 'en', script: 'latin',
    })

    await importRows(user, rows)
    expect(await storedOpeners(user)).toHaveLength(first.length)

    const changed = rows.map((row) => (row['Company Name'] === DIVYANK_NAME ? { ...row, 'Call Opener': 'A changed opener' } : row))
    await importRows(user, changed)
    const after = await storedOpeners(user)
    expect(after).toHaveLength(first.length)
    expect(after.find((row) => row.company_id === divyankId)?.body).toBe('A changed opener')
  }, SETUP_TIMEOUT)

  it('writes nothing for a blank opener and keeps the stored one when a re-import has none', async () => {
    const user = await newUser('opener-blank')
    await importRows(user, [{ ...DIVYANK, 'Call Opener': '   ' }])
    expect(await storedOpeners(user)).toHaveLength(0)

    await importRows(user, [DIVYANK])
    await importRows(user, [{ ...DIVYANK, 'Call Opener': '' }])
    expect(await storedOpeners(user)).toHaveLength(1)
  }, SETUP_TIMEOUT)

  it('shows a lead its own opener, never another company\'s, and keeps generic ones after it', async () => {
    const user = await newUser('opener-leak')
    await importRows(user, [DIVYANK, ABHINAV])
    const generic = await user.client.from('content_variants').insert({
      workspace_id: user.workspaceId, kind: 'opener', mix: 'en', body: 'Generic hello',
    })
    if (generic.error) throw generic.error

    const divyank = await loadLead(user.client, user.workspaceId, await companyId(user, DIVYANK_NAME))
    const bodies = divyank.openers.map((opener) => opener.body)
    expect(bodies).toContain(DIVYANK['Call Opener'].trim())
    expect(bodies).toContain('Generic hello')
    expect(bodies).not.toContain(ABHINAV['Call Opener'].trim())

    const shown = buildOpenerChoices(divyank).openers.map((opener) => opener.text)
    expect(shown[0]).toBe(DIVYANK['Call Opener'].trim())
    expect(shown).not.toContain(ABHINAV['Call Opener'].trim())
  }, SETUP_TIMEOUT)

  it('still finds a company opener when 200 generic openers come first', async () => {
    const user = await newUser('opener-limit')
    const bulk = Array.from({ length: 210 }, (_, position) => ({
      workspace_id: user.workspaceId, kind: 'opener' as const, mix: 'en', body: `Generic ${position}`,
    }))
    const inserted = await user.client.from('content_variants').insert(bulk)
    if (inserted.error) throw inserted.error
    await importRows(user, [DIVYANK])

    const lead = await loadLead(user.client, user.workspaceId, await companyId(user, DIVYANK_NAME))
    expect(lead.openers.map((opener) => opener.body)).toContain(DIVYANK['Call Opener'].trim())
  }, SETUP_TIMEOUT)

  it('deletes a company\'s opener with the company', async () => {
    const user = await newUser('opener-cascade')
    await importRows(user, [DIVYANK])
    const removed = await user.client.from('companies').delete().eq('id', await companyId(user, DIVYANK_NAME))
    if (removed.error) throw removed.error
    expect(await storedOpeners(user)).toHaveLength(0)
  }, SETUP_TIMEOUT)
})
