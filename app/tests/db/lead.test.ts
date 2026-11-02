/**
 * Database tests for the lead workspace: loadLead (entry-offer fallback, people,
 * workspace scoping), listLeads (search and filters), saveContact, addNote and
 * recheckSiteForCompany (with a fake fetch). Local Supabase stack only.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { addNoteToCompany } from '@/lib/leads/addNote'
import { listLeads } from '@/lib/leads/listLeads'
import type { LeadListParams } from '@/lib/leads/listParams'
import { LeadNotFoundError, loadLead } from '@/lib/leads/loadLead'
import { loadFilterOptions } from '@/lib/leads/loadFilterOptions'
import { saveContact } from '@/lib/leads/saveContact'
import { recheckSiteForCompany } from '@/lib/site-check/recheckSiteForCompany'
import type { ProbeFetch } from '@/lib/site-check/probeSite'
import { cleanup, createUserWithWorkspace, localStack, type LocalStack, type TestUser } from './support'

const SETUP_TIMEOUT = 120_000
const BROKEN = 'Broken/wrong website live on Google profile right now'
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

type CompanyExtra = Record<string, unknown>

async function addCompany(user: TestUser, name: string, extra: CompanyExtra = {}): Promise<string> {
  const result = await user.client
    .from('companies')
    .insert({ workspace_id: user.workspaceId, name, ...extra })
    .select('id')
    .single()
  if (result.error) throw result.error
  return result.data.id
}

const PUBLIC_RESOLVE = async () => ['93.184.216.34']
function fetchReturning(status: number): { fetch: ProbeFetch; calls: string[] } {
  const calls: string[] = []
  const fetch: ProbeFetch = async (url) => {
    calls.push(url)
    return { status, headers: { get: () => null }, body: null }
  }
  return { fetch, calls }
}

describe('loadLead', () => {
  it('uses the company entry offer, else the vertical default', async () => {
    const user = await newUser('lead-offer')
    await user.client.from('vertical_defaults').insert({
      workspace_id: user.workspaceId, vertical: 'Clinics', entry_offer: 'Default clinic offer', long_term_opportunity: 'Default clinic plan',
    })
    const own = await addCompany(user, 'Own Offer Co', { vertical: 'Clinics', entry_offer: 'Special offer' })
    const inherited = await addCompany(user, 'Inherited Co', { vertical: 'Clinics', entry_offer: null })
    const noDefault = await addCompany(user, 'No Default Co', { vertical: 'Unknown vertical' })

    expect((await loadLead(user.client, user.workspaceId, own)).entryOffer).toBe('Special offer')
    const viewInherited = await loadLead(user.client, user.workspaceId, inherited)
    expect(viewInherited.entryOffer).toBe('Default clinic offer')
    expect(viewInherited.entryOfferIsDefault).toBe(true)
    expect(viewInherited.longTermOpportunity).toBe('Default clinic plan')
    expect((await loadLead(user.client, user.workspaceId, noDefault)).entryOffer).toBeNull()
  })

  it('returns people, numbers, openers, the workspace mix and the timeline', async () => {
    const user = await newUser('lead-full')
    const companyId = await addCompany(user, 'Full Co', { vertical: 'Clinics', intent_signal: 'Hiring' })
    const contact = await user.client
      .from('contacts')
      .insert({ workspace_id: user.workspaceId, company_id: companyId, name: 'రమేష్', name_latin: 'ramesh', role: 'decision_maker', mix_profile: 'te+en' })
      .select('id')
      .single()
    if (contact.error) throw contact.error
    const points = await user.client.from('contact_points').insert([
      {
        workspace_id: user.workspaceId, company_id: companyId, contact_id: contact.data.id,
        e164: '+919866139900', kind: 'business' as const, wa_status: 'unconfirmed' as const,
      },
      { workspace_id: user.workspaceId, company_id: companyId, e164: '+914023456789', kind: 'landline' as const, wa_status: 'landline' as const },
    ])
    if (points.error) throw points.error
    await user.client.from('content_variants').insert([
      { workspace_id: user.workspaceId, kind: 'opener' as const, mix: 'te+en', body: 'Namaskaram {name}', vertical: 'Clinics' },
      { workspace_id: user.workspaceId, kind: 'opener' as const, mix: 'en', body: 'Hello {name}' },
      { workspace_id: user.workspaceId, kind: 'script' as const, mix: 'en', body: 'Not an opener' },
    ])
    await user.client.from('tasks').insert({ workspace_id: user.workspaceId, company_id: companyId, title: 'Call back' })
    await addNoteToCompany(user.client, user.workspaceId, companyId, 'First note')

    const view = await loadLead(user.client, user.workspaceId, companyId)
    expect(view.company.name).toBe('Full Co')
    expect(view.contacts).toHaveLength(1)
    expect(view.contacts[0]).toMatchObject({ name: 'రమేష్', nameLatin: 'ramesh', role: 'decision_maker', mixProfile: 'te+en' })
    expect(view.points.map((p) => p.e164).sort()).toEqual(['+914023456789', '+919866139900'])
    expect(view.points.find((p) => p.e164 === '+914023456789')).toMatchObject({ contactId: null, waStatus: 'landline' })
    expect(view.openers.map((o) => o.body).sort()).toEqual(['Hello {name}', 'Namaskaram {name}'])
    expect(view.workspaceMix).toEqual(['te', 'hi', 'en'])
    expect(view.tasks.map((t) => t.title)).toEqual(['Call back'])
    expect(view.activities.map((a) => a.body)).toEqual(['First note'])
  })

  it('throws LeadNotFoundError for another workspace, a missing id and a non-uuid', async () => {
    const owner = await newUser('lead-owner')
    const other = await newUser('lead-other')
    const companyId = await addCompany(owner, 'Private Co')
    await expect(loadLead(other.client, other.workspaceId, companyId)).rejects.toThrow(LeadNotFoundError)
    await expect(loadLead(owner.client, owner.workspaceId, '00000000-0000-4000-8000-000000000000')).rejects.toThrow(
      /\[loadLead\] find company 00000000-0000-4000-8000-000000000000 failed: not found/,
    )
    await expect(loadLead(owner.client, owner.workspaceId, 'nope')).rejects.toThrow(LeadNotFoundError)
  })
})

describe('listLeads', () => {
  async function seed(user: TestUser) {
    await addCompany(user, 'Alpha Clinic', { vertical: 'Clinics', area: 'Uppal', priority: 'A', website_status: 'No website', base_score: 70 })
    await addCompany(user, 'Beta Clinic', { vertical: 'Clinics', area: 'Balanagar', priority: 'B', website_status: 'Own site - loads', base_score: 60 })
    await addCompany(user, 'Gamma Interiors', { vertical: 'Interiors', area: 'Uppal', priority: 'A', website_status: 'Own site - loads', base_score: 80 })
    await addCompany(user, 'Delta Works', { vertical: 'Interiors', area: 'Kukatpally', priority: 'C', base_score: 10 })
  }
  const none: LeadListParams = { q: '', vertical: '', area: '', priority: '', websiteStatus: '', page: 1 }

  it('lists by priority then score, and filters by each field', async () => {
    const user = await newUser('list-filter')
    await seed(user)
    const names = async (params: Partial<LeadListParams>) =>
      (await listLeads(user.client, user.workspaceId, { ...none, ...params })).rows.map((r) => r.name)

    expect(await names({})).toEqual(['Gamma Interiors', 'Alpha Clinic', 'Beta Clinic', 'Delta Works'])
    expect(await names({ vertical: 'Clinics' })).toEqual(['Alpha Clinic', 'Beta Clinic'])
    expect(await names({ area: 'uppal' })).toEqual(['Gamma Interiors', 'Alpha Clinic'])
    expect(await names({ priority: 'A' })).toEqual(['Gamma Interiors', 'Alpha Clinic'])
    expect(await names({ websiteStatus: 'Own site - loads' })).toEqual(['Gamma Interiors', 'Beta Clinic'])
    expect(await names({ vertical: 'Interiors', priority: 'A' })).toEqual(['Gamma Interiors'])
  })

  it('searches, and combines search with filters', async () => {
    const user = await newUser('list-search')
    await seed(user)
    const names = async (params: Partial<LeadListParams>) =>
      (await listLeads(user.client, user.workspaceId, { ...none, ...params })).rows.map((r) => r.name)
    expect(await names({ q: 'clinic' })).toEqual(['Alpha Clinic', 'Beta Clinic'])
    expect(await names({ q: 'clinic', priority: 'B' })).toEqual(['Beta Clinic'])
    expect(await names({ q: 'uppal' })).toHaveLength(2)
  })

  it('treats a % or _ in the area filter as plain text', async () => {
    const user = await newUser('list-wildcard')
    await seed(user)
    expect((await listLeads(user.client, user.workspaceId, { ...none, area: '%' })).rows).toEqual([])
  })

  it('pages at 50 and reports whether there is a next page', async () => {
    const user = await newUser('list-page')
    const rows = Array.from({ length: 55 }, (_, i) => ({
      workspace_id: user.workspaceId, name: `Bulk ${String(i).padStart(2, '0')}`, priority: 'A' as const, base_score: 100 - i,
    }))
    const inserted = await user.client.from('companies').insert(rows)
    if (inserted.error) throw inserted.error
    const first = await listLeads(user.client, user.workspaceId, none)
    expect(first.rows).toHaveLength(50)
    expect(first.hasNext).toBe(true)
    const second = await listLeads(user.client, user.workspaceId, { ...none, page: 2 })
    expect(second.rows).toHaveLength(5)
    expect(second.hasNext).toBe(false)
  })

  it("never lists another workspace's companies", async () => {
    const mine = await newUser('list-mine')
    const theirs = await newUser('list-theirs')
    await seed(theirs)
    expect((await listLeads(mine.client, mine.workspaceId, none)).rows).toEqual([])
    expect((await listLeads(mine.client, mine.workspaceId, { ...none, q: 'clinic' })).rows).toEqual([])
    expect((await listLeads(mine.client, theirs.workspaceId, none)).rows).toEqual([])
  })

  it('collects the filter options of the workspace', async () => {
    const user = await newUser('list-options')
    await seed(user)
    expect(await loadFilterOptions(user.client, user.workspaceId)).toEqual({
      verticals: ['Clinics', 'Interiors'],
      websiteStatuses: ['No website', 'Own site - loads'],
    })
  })
})

describe('saveContact', () => {
  it('creates a contact with name_latin and a normalised phone point', async () => {
    const user = await newUser('contact-create')
    const companyId = await addCompany(user, 'Contact Co')
    const result = await saveContact(user.client, user.workspaceId, {
      companyId, name: 'రమేష్', nameLatin: ' ramesh ', role: 'decision_maker', languages: 'te+en', phone: '98661 39900', notes: 'Prefers evenings',
    })

    const contact = await user.client.from('contacts').select('*').eq('id', result.contactId).single()
    expect(contact.data).toMatchObject({
      company_id: companyId, name: 'రమేష్', name_latin: 'ramesh', role: 'decision_maker',
      languages: ['te', 'en'], mix_profile: 'te+en', notes: 'Prefers evenings',
    })
    const points = await user.client.from('contact_points').select('*').eq('contact_id', result.contactId)
    expect(points.data).toHaveLength(1)
    expect(points.data![0]).toMatchObject({ e164: '+919866139900', kind: 'business', wa_status: 'unconfirmed', company_id: companyId })
  })

  it('stores a landline number as a landline point that cannot get a WhatsApp link', async () => {
    const user = await newUser('contact-landline')
    const companyId = await addCompany(user, 'Landline Co')
    const result = await saveContact(user.client, user.workspaceId, { companyId, name: 'Front desk', role: 'gatekeeper', phone: '040 2345 6789' })
    const points = await user.client.from('contact_points').select('*').eq('contact_id', result.contactId)
    expect(points.data![0]).toMatchObject({ e164: '+914023456789', kind: 'landline', wa_status: 'landline' })
  })

  it('updates the role and name_latin of an existing contact without touching its numbers', async () => {
    const user = await newUser('contact-update')
    const companyId = await addCompany(user, 'Update Co')
    const created = await saveContact(user.client, user.workspaceId, { companyId, name: 'Suresh', phone: '9866139900' })
    await saveContact(user.client, user.workspaceId, {
      companyId, contactId: created.contactId, name: 'సురేష్', nameLatin: 'suresh', role: 'gatekeeper',
    })
    const contact = await user.client.from('contacts').select('name, name_latin, role').eq('id', created.contactId).single()
    expect(contact.data).toEqual({ name: 'సురేష్', name_latin: 'suresh', role: 'gatekeeper' })
    const points = await user.client.from('contact_points').select('id').eq('contact_id', created.contactId)
    expect(points.data).toHaveLength(1)
  })

  it('rejects bad input with a validation error and writes nothing', async () => {
    const user = await newUser('contact-invalid')
    const companyId = await addCompany(user, 'Invalid Co')
    for (const input of [
      { companyId: 'not-a-uuid', name: 'X' },
      { companyId, name: 'X', role: 'boss' },
      { companyId, name: 'X', phone: '123' },
      { companyId, name: 'x'.repeat(500) },
      { companyId, name: 'X', languages: 'te+zz' },
      'not an object',
    ]) {
      await expect(saveContact(user.client, user.workspaceId, input)).rejects.toThrow(/\[validateContactInput\]/)
    }
    const contacts = await user.client.from('contacts').select('id').eq('company_id', companyId)
    expect(contacts.data).toHaveLength(0)
  })

  it("cannot attach a contact to another workspace's company", async () => {
    const owner = await newUser('contact-owner')
    const other = await newUser('contact-other')
    const companyId = await addCompany(owner, 'Owner Co')
    await expect(saveContact(other.client, other.workspaceId, { companyId, name: 'Intruder' })).rejects.toThrow(
      /\[saveContact\] find company .* failed: not found/,
    )
    const contacts = await owner.client.from('contacts').select('id').eq('company_id', companyId)
    expect(contacts.data).toHaveLength(0)
  })

  it("cannot edit another workspace's contact", async () => {
    const owner = await newUser('contact-edit-owner')
    const other = await newUser('contact-edit-other')
    const ownerCompany = await addCompany(owner, 'Edit Owner Co')
    const otherCompany = await addCompany(other, 'Edit Other Co')
    const created = await saveContact(owner.client, owner.workspaceId, { companyId: ownerCompany, name: 'Private' })
    await expect(
      saveContact(other.client, other.workspaceId, { companyId: otherCompany, contactId: created.contactId, name: 'Hijack' }),
    ).rejects.toThrow(/\[saveContact\] find contact .* failed: not found/)
    const contact = await owner.client.from('contacts').select('name').eq('id', created.contactId).single()
    expect(contact.data?.name).toBe('Private')
  })
})

describe('addNoteToCompany', () => {
  it('appends a note activity', async () => {
    const user = await newUser('note-add')
    const companyId = await addCompany(user, 'Note Co')
    await addNoteToCompany(user.client, user.workspaceId, companyId, '  Asked for a quote  ')
    const rows = await user.client.from('activities').select('type, body, metadata').eq('company_id', companyId)
    expect(rows.data).toEqual([{ type: 'note', body: 'Asked for a quote', metadata: { event: 'note' } }])
  })

  it('rejects a blank note and a note on another workspace company', async () => {
    const owner = await newUser('note-owner')
    const other = await newUser('note-other')
    const companyId = await addCompany(owner, 'Note Owner Co')
    await expect(addNoteToCompany(owner.client, owner.workspaceId, companyId, '  ')).rejects.toThrow(/\[validateNoteInput\]/)
    await expect(addNoteToCompany(other.client, other.workspaceId, companyId, 'hi')).rejects.toThrow(/\[addNote\] find company/)
  })
})

describe('recheckSiteForCompany', () => {
  async function siteCompany(user: TestUser, extra: CompanyExtra = {}) {
    return addCompany(user, 'Site Co', {
      website_url: 'https://siteco.example', website_status: 'Own site - failed to load in check', intent_signal: BROKEN, ...extra,
    })
  }
  async function readCompany(user: TestUser, id: string) {
    const result = await user.client.from('companies').select('website_status, intent_signal').eq('id', id).single()
    if (result.error) throw result.error
    return result.data
  }
  async function siteActivities(user: TestUser, id: string) {
    const result = await user.client.from('activities').select('type, body, metadata').eq('company_id', id).eq('type', 'site_recheck')
    if (result.error) throw result.error
    return result.data
  }

  it('sets "Own site - loads" on a 200, drops the broken-website signal and logs site_recheck', async () => {
    const user = await newUser('recheck-loads')
    const id = await siteCompany(user)
    const fake = fetchReturning(200)
    const result = await recheckSiteForCompany(user.client, user.workspaceId, id, { fetch: fake.fetch, resolve: PUBLIC_RESOLVE })

    expect(result).toEqual({ websiteStatus: 'Own site - loads' })
    expect(await readCompany(user, id)).toEqual({ website_status: 'Own site - loads', intent_signal: null })
    const activities = await siteActivities(user, id)
    expect(activities).toHaveLength(1)
    expect(activities[0].metadata).toMatchObject({
      event: 'site_recheck', from: 'Own site - failed to load in check', to: 'Own site - loads',
    })
    expect(fake.calls).toEqual(['https://siteco.example/'])
  })

  it('sets "failed to load" on a 5xx and keeps the signal', async () => {
    const user = await newUser('recheck-5xx')
    const id = await siteCompany(user, { website_status: 'Own site - loads' })
    const result = await recheckSiteForCompany(user.client, user.workspaceId, id, {
      fetch: fetchReturning(503).fetch, resolve: PUBLIC_RESOLVE,
    })
    expect(result).toEqual({ websiteStatus: 'Own site - failed to load in check' })
    expect((await readCompany(user, id)).intent_signal).toBe(BROKEN)
    expect(await siteActivities(user, id)).toHaveLength(1)
  })

  it('sets "failed to load" on a timeout', async () => {
    const user = await newUser('recheck-timeout')
    const id = await siteCompany(user, { website_status: 'Own site - loads' })
    const hanging: ProbeFetch = (_url, init) =>
      new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('x', 'AbortError'))))
    const result = await recheckSiteForCompany(user.client, user.workspaceId, id, { fetch: hanging, resolve: PUBLIC_RESOLVE, timeoutMs: 30 })
    expect(result.websiteStatus).toBe('Own site - failed to load in check')
  })

  it('writes no activity when the status did not change', async () => {
    const user = await newUser('recheck-same')
    const id = await siteCompany(user, { website_status: 'Own site - loads', intent_signal: null })
    await recheckSiteForCompany(user.client, user.workspaceId, id, { fetch: fetchReturning(200).fetch, resolve: PUBLIC_RESOLVE })
    expect(await siteActivities(user, id)).toHaveLength(0)
  })

  it('does not drop the signal when the previous status was not "failed"', async () => {
    const user = await newUser('recheck-unchecked')
    const id = await siteCompany(user, { website_status: 'Not checked yet' })
    await recheckSiteForCompany(user.client, user.workspaceId, id, { fetch: fetchReturning(200).fetch, resolve: PUBLIC_RESOLVE })
    expect((await readCompany(user, id)).intent_signal).toBe(BROKEN)
  })

  it('refuses a private address stored as the website, without fetching or changing anything', async () => {
    const user = await newUser('recheck-ssrf')
    for (const url of ['http://169.254.169.254/latest/meta-data/', 'http://localhost/admin', 'http://10.0.0.1']) {
      const id = await siteCompany(user, { website_url: url })
      const fake = fetchReturning(200)
      await expect(
        recheckSiteForCompany(user.client, user.workspaceId, id, { fetch: fake.fetch, resolve: PUBLIC_RESOLVE }),
      ).rejects.toThrow(/\[recheckSiteForCompany] check website of "Site Co" failed: .*not allowed/)
      expect(fake.calls).toEqual([])
      expect((await readCompany(user, id)).website_status).toBe('Own site - failed to load in check')
      expect(await siteActivities(user, id)).toHaveLength(0)
    }
  })

  it('refuses a company with no website, and a directory or social page', async () => {
    const user = await newUser('recheck-nosite')
    const none = await addCompany(user, 'No Site Co')
    const platform = await addCompany(user, 'Facebook Co', { website_url: 'https://www.facebook.com/someshop' })
    const fake = fetchReturning(200)
    const deps = { fetch: fake.fetch, resolve: PUBLIC_RESOLVE }
    await expect(recheckSiteForCompany(user.client, user.workspaceId, none, deps)).rejects.toThrow(/no website address/)
    await expect(recheckSiteForCompany(user.client, user.workspaceId, platform, deps)).rejects.toThrow(/not a business's own website/)
    expect(fake.calls).toEqual([])
  })

  it("cannot re-check another workspace's company, and validates the id", async () => {
    const owner = await newUser('recheck-owner')
    const other = await newUser('recheck-other')
    const id = await siteCompany(owner)
    const fake = fetchReturning(200)
    const deps = { fetch: fake.fetch, resolve: PUBLIC_RESOLVE }
    await expect(recheckSiteForCompany(other.client, other.workspaceId, id, deps)).rejects.toThrow(/\[recheckSiteForCompany] find company .* failed: not found/)
    await expect(recheckSiteForCompany(owner.client, owner.workspaceId, 'abc', deps)).rejects.toThrow(/companyId must be a uuid/)
    expect(fake.calls).toEqual([])
    expect((await readCompany(owner, id)).website_status).toBe('Own site - failed to load in check')
  })
})
