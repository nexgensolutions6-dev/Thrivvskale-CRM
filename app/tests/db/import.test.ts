import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { importLeads } from '@/lib/import/importLeads'
import { mapLeadRow } from '@/lib/import/mapLeadRow'
import { parseLeadsCsv } from '@/lib/import/parseLeadsCsv'
import { PLATFORM_DOMAINS } from '@/lib/import/platformDomains'
import {
  cleanup,
  createUserWithWorkspace,
  localStack,
  type LocalStack,
  type TestUser,
} from './support'

const SETUP_TIMEOUT = 120_000
const REAL_CSV = readFileSync(new URL('../../data/Thrivvskale_Leads_CRM_Import.csv', import.meta.url), 'utf8')
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

function importCsv(user: TestUser, csv: string) {
  return importRows(user, parseLeadsCsv(csv))
}

function importRows(user: TestUser, rawRows: Record<string, string>[]) {
  return importLeads(user.client, user.workspaceId, rawRows.map(mapLeadRow), rawRows)
}

/** A real fixture row with some cells replaced, for companies the files lack. */
function syntheticRow(overrides: Record<string, string>): Record<string, string> {
  const [template] = parseLeadsCsv(SAMPLE_CSV)
  return { ...template, Phone: '', 'WhatsApp (verified)': '', Website: '', ...overrides }
}

async function countRows(user: TestUser, table: 'companies' | 'import_rows' | 'tasks'): Promise<number> {
  const result = await user.client.from(table).select('*', { count: 'exact', head: true })
  if (result.error) throw result.error
  return result.count ?? 0
}

describe('PLATFORM_DOMAINS', () => {
  it('lists the platform domains a website match must never use', () => {
    for (const domain of [
      'netlify.app', 'justdial.com', 'chatgpt.com', 'business.site',
      'facebook.com', 'instagram.com', 'wixsite.com',
    ]) {
      expect(PLATFORM_DOMAINS).toContain(domain)
    }
  })
})

describe('importLeads: the real CSV', () => {
  it('inserts 297 companies, flags 4 without a number, stores the raw rows, then does nothing the second time', async () => {
    const user = await newUser('import-real')

    const first = await importCsv(user, REAL_CSV)

    expect(first).toEqual({
      inserted: 297,
      updated: 0,
      needsNumber: 4,
      websiteInvalid: 13,
      unparsedWhatsapp: 1,
    })
    expect(await countRows(user, 'companies')).toBe(297)
    expect(await countRows(user, 'import_rows')).toBe(297)

    const flagged = await user.client.from('companies').select('id').eq('needs_number', true)
    expect(flagged.data).toHaveLength(4)
    const tasks = await user.client.from('tasks').select('company_id, title').eq('title', 'find number')
    expect(tasks.data).toHaveLength(4)

    const stored = await user.client.from('import_rows').select('raw, status').eq('row_number', 1).single()
    expect(stored.data?.raw).toMatchObject({ 'Company Name': 'Divyank Industries (Water Purification)' })
    expect(stored.data?.status).toBe('imported')

    const second = await importCsv(user, REAL_CSV)

    expect(second.inserted).toBe(0)
    expect(second.updated).toBe(297)
    expect(await countRows(user, 'companies')).toBe(297)
    expect(await countRows(user, 'tasks')).toBe(4)
    const points = await user.client.from('contact_points').select('e164')
    expect(new Set(points.data?.map((p) => p.e164)).size).toBe(points.data?.length)
  }, SETUP_TIMEOUT)
})

describe('importLeads: matching', () => {
  it('keeps two companies that share only a platform website', async () => {
    const user = await newUser('import-platform')

    const report = await importRows(user, [
      syntheticRow({ 'Company Name': 'Alpha Traders', Phone: '+919000000001', Website: 'https://netlify.app' }),
      syntheticRow({ 'Company Name': 'Beta Traders', Phone: '+919000000002', Website: 'https://netlify.app' }),
    ])

    expect(report.inserted).toBe(2)
    expect(await countRows(user, 'companies')).toBe(2)
  }, SETUP_TIMEOUT)

  it('updates, not duplicates, a company that has the same phone as an existing one', async () => {
    const user = await newUser('import-phone')
    await importRows(user, [syntheticRow({ 'Company Name': 'Gamma Works', Phone: '+919000000003' })])

    const report = await importRows(user, [
      syntheticRow({ 'Company Name': 'Gamma Works (new name)', Phone: '09000000003', Area: 'Kukatpally' }),
    ])

    expect(report).toMatchObject({ inserted: 0, updated: 1 })
    const companies = await user.client.from('companies').select('name, area')
    expect(companies.data).toEqual([{ name: 'Gamma Works (new name)', area: 'Kukatpally' }])
  }, SETUP_TIMEOUT)

  it('matches on a second phone number and on a shared own-website domain', async () => {
    const user = await newUser('import-any-phone')
    await importRows(user, [
      syntheticRow({
        'Company Name': 'Delta Clinic',
        Phone: '+919000000004',
        'WhatsApp (verified)': '+919000000005',
        Website: 'https://www.deltaclinic.com',
      }),
    ])

    const report = await importRows(user, [
      syntheticRow({ 'Company Name': 'Delta by whatsapp', Phone: '+919000000099', 'WhatsApp (verified)': '+919000000005' }),
      syntheticRow({ 'Company Name': 'Delta by site', Phone: '+919000000098', Website: 'http://deltaclinic.com/contact' }),
    ])

    expect(report).toMatchObject({ inserted: 0, updated: 2 })
    expect(await countRows(user, 'companies')).toBe(1)
  }, SETUP_TIMEOUT)

  it('creates one find-number task per company without a number, not another on re-import', async () => {
    const user = await newUser('import-find-number')
    const rows = [syntheticRow({ 'Company Name': 'Epsilon Stores', 'WhatsApp Status': 'No number yet', Website: 'epsilonstores.in' })]

    const first = await importRows(user, rows)
    const second = await importRows(user, rows)

    expect(first).toMatchObject({ inserted: 1, needsNumber: 1 })
    expect(second).toMatchObject({ inserted: 0, updated: 1 })
    expect(await countRows(user, 'tasks')).toBe(1)
  }, SETUP_TIMEOUT)
})

describe('importLeads: vertical defaults', () => {
  it('stores the most frequent entry offer per vertical and nulls it on companies that use it', async () => {
    const user = await newUser('import-defaults')
    const row = (name: string, phone: string, offer: string) =>
      syntheticRow({ 'Company Name': name, Phone: phone, Industry: 'Coaching & Education', 'Entry Offer': offer })

    await importRows(user, [
      row('Zeta One', '+919000000011', 'Offer A'),
      row('Zeta Two', '+919000000012', 'Offer A'),
      row('Zeta Three', '+919000000013', 'Offer B'),
    ])

    const defaults = await user.client.from('vertical_defaults').select('vertical, entry_offer')
    expect(defaults.data).toEqual([{ vertical: 'Coaching & Education', entry_offer: 'Offer A' }])
    const companies = await user.client.from('companies').select('name, entry_offer').order('name')
    expect(companies.data).toEqual([
      { name: 'Zeta One', entry_offer: null },
      { name: 'Zeta Three', entry_offer: 'Offer B' },
      { name: 'Zeta Two', entry_offer: null },
    ])
  }, SETUP_TIMEOUT)
})
